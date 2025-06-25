import express from "express";
import db from "../utils/connect-mysql.js";
import upload from "../utils/upload-imgs.js";
import dayjs from "dayjs";
import ecpay_payment from 'ecpay_aio_nodejs';
import jwt from "jsonwebtoken";

const { MERCHANTID, HASHKEY, HASHIV, HOST } = process.env;
const router = express.Router();

const options = {
  OperationMode: 'Test', // Test or Production
  MercProfile: {
    MerchantID: MERCHANTID,
    HashKey: HASHKEY,
    HashIV: HASHIV,
    MercProfile: 'Default'
  },
  IgnorePayment: [
    //    "Credit",
    //    "WebATM",
    //    "ATM",
    //    "CVS",
    //    "BARCODE",
    //    "AndroidPay"
  ],
  IsProjectContractor: false,
};
let TradeNo;

router.use((req, res, next) => {
  const u = req.url.split("?")[0]; // 只要路徑
  console.log({ u });
  if (req.method === "GET" && u === "/") {
    return next();
  }
  next();
});

const getListData = async (req) => {
  const perPage = 6; // 每頁幾筆
  let page = +req.query.page || 1; // 用戶決定要看第幾頁
  let keyword =
    req.query.keyword && typeof req.query.keyword === "string"
      ? req.query.keyword.trim()
      : "";
  let keyword_ = db.escape(`%${keyword}%`);

  let qs = {}; // 用來把 query string 的設定傳給 template
  // 起始的日期
  let startDate = req.query.startDate ? req.query.startDate.trim() : "";
  const startDateD = dayjs(startDate);
  if (startDateD.isValid()) {
    startDate = startDateD.format("YYYY-MM-DD");
  } else {
    startDate = "";
  }

  // 結束的日期
  let endDate = req.query.endDate ? req.query.endDate.trim() : "";
  const endDateD = dayjs(endDate);
  if (endDateD.isValid()) {
    endDate = endDateD.format("YYYY-MM-DD");
  } else {
    endDate = "";
  }

  let where = ` WHERE sid=${sid} `;
  if (keyword) {
    qs.keyword = keyword;
    where += ` AND ( \`name\` LIKE ${keyword_} OR \`phone\` LIKE ${keyword_} ) `;
  }
  if (startDate) {
    qs.startDate = startDate;
    where += ` AND order_date >= '${startDate}' `;
  }
  if (endDate) {
    qs.endDate = endDate;
    where += ` AND order_date <= '${endDate}' `;
  }

  let totalRows = 0;
  let totalPages = 0;
  let rows = [];

  let output = {
    success: false,
    page,
    perPage,
    rows,
    totalRows,
    totalPages,
    qs,
    redirect: "",
    info: "",
  };

  if (page < 1) {
    output.redirect = `?page=1`;
    output.info = `頁碼值小於 1`;
    return output;
  }

  const t_sql = `SELECT COUNT(1) totalRows FROM order_list ${where}`;
  [[{ totalRows }]] = await db.query(t_sql);
  totalPages = Math.ceil(totalRows / perPage);
  if (totalRows > 0) {
    if (page > totalPages) {
      output.redirect = `?page=${totalPages}`;
      output.info = `頁碼值大於總頁數`;
      return { ...output, totalRows, totalPages };
    }

    const sql = `SELECT * FROM order_list ${where} ORDER BY oid DESC 
    LIMIT ${(page - 1) * perPage}, ${perPage}`;
    [rows] = await db.query(sql);
    output = { ...output, success: true, rows, totalRows, totalPages };
  }

  return output;
};

router.get("/api", async (req, res) => {
  res.json(await getListData(req));
  /*
  if(res.locals.jwt?.sid){
    return res.json(await getListData(req));
  } else {
    return res.json({success: false, error: "沒有授權, 不能取得資料"});
  }
  */
});

// 取得某會員底下所有訂單
router.get("/person/:sid", async (req, res) => {
  try {
    let sid = req.params.sid || 1; // 使用 req.params.sid 來獲取路徑參數
    let page = parseInt(req.query.page) || 1;
    let perPage = 5;
    let where = `WHERE sid=${sid}`;
    let totalRows = 0;
    let totalPages = 1;
    let [rows, fields] = await db.query(
      `SELECT * FROM order_list WHERE sid=${sid} ORDER BY oid DESC`
    );

    let output = {
      success: false,
      page: 1,
      perPage: 5,
      rows,
      totalRows,
      totalPages: 1,
      qs: {},
      redirect: "",
      info: "",
    };

    if (page < 1) {
      output.redirect = `?page=1`;
      output.info = `頁碼值小於 1`;
      return output;
    }

    const t_sql = `SELECT COUNT(1) totalRows FROM order_list ${where}`;
    [[{ totalRows }]] = await db.query(t_sql);
    totalPages = Math.ceil(totalRows / perPage);
    if (totalRows > 0) {
      if (page > totalPages) {
        output.redirect = `?page=${totalPages}`;
        output.info = `頁碼值大於總頁數`;
        return { ...output, totalRows, totalPages };
      }

      const sql = `SELECT * FROM order_list ${where} ORDER BY oid DESC 
    LIMIT ${(page - 1) * perPage}, ${perPage}`;
      [rows] = await db.query(sql);
      output = { ...output, success: true, rows, totalRows, totalPages };
    }

    return res.json(output);

  } catch (ex) {
    // 如有異常則跳出以下提示
    const output = {
      success: false,
      exception: {
        message: ex.message,
        stack: ex.stack,
      },
    };
    // 提示錯誤信息
    res.status(500).json(output);
  }
});

// 取得個人某筆訂單資訊
router.post("/one/:oid", async (req, res) => {
  let oid = +req.params.oid;
  if (isNaN(oid)) {
    return res.status(400).json({ success: false, message: "訂單編號錯誤" });
  }

  let token = req.body.token;

  if (!token) {
    return res.status(401).json({ success: false, error: "沒有授權，不能取得資料" })
  }
  try {
    // 驗證並解碼 token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // 將解碼的資訊存入 res.locals，供後續使用
    res.locals.jwt = decoded;

    if (res.locals.jwt?.sid) {
      let sid = res.locals.jwt.sid

      // 查詢這筆訂單是否屬於該會員
      const [rows] = await db.query(
        `SELECT DISTINCT
          o.sid, o.order_name, o.total, o.order_phone, o.order_email,
          o.shipping_zipcode, o.shipping_address, o.pay_way, o.order_status,
          cu.coupon_id, c.discount_coins,
          p.pid, p.product_name, p.product_img,
          oc.sale_price, oc.actual_amount
        FROM order_list o
        INNER JOIN order_child oc ON oc.oid = o.oid
        INNER JOIN product p ON p.pid = oc.pid
        LEFT JOIN coupon_use cu ON cu.coupon_detail_id = o.coupon_detail_id
        LEFT JOIN coupon c ON c.coupon_id = cu.coupon_id
        WHERE o.oid = ? AND o.sid = ?`,
        [oid, sid]
      );

      if (rows.length) {
        return res.json(rows);
      } else {
        return res.status(403).json({ success: false, message: "查無此訂單或無權限" });
      }
    }

  } catch (error) {
    // 如果 token 驗證失敗或發生其他錯誤，返回沒有授權
    return res.status(401).json({ success: false, error: "無效的 Token", details: error.message });

  }

});

router.post("/add", upload.none(), async (req, res) => {
  const output = {
    success: false,
    postData: req.body,
  };

  // 準備存進第一張order_list, name是前端定義接收的名字
  const {
    name,
    sid,
    phone,
    email,
    pay_way,
    postcode,
    address,
    coupon_id,
    pid, // pid 是一個陣列
    actual_amount, // actual_amount 也是一個陣列
  } = req.body;

  // 驗證商品 ID 和數量的格式與數量是否匹配
  if (
    !Array.isArray(pid) ||
    !Array.isArray(actual_amount) ||
    pid.length !== actual_amount.length
  ) {
    return res.status(400).json({
      success: false,
      message: "商品 ID 和數量資料格式不正確或數據不匹配",
    });
  }

  try {
    // 從資料庫查詢商品價格
    const [products] = await db.query(
      "SELECT pid, product_price FROM product WHERE pid IN (?)",
      [pid]
    );

    // 計算購物車金額
    let netTotal = 0;
    let product;
    for (let i = 0; i < pid.length; i++) {
      product = products.find((p) => p.pid === pid[i]);
      if (!product) {
        return res
          .status(400)
          .json({ success: false, message: `找不到商品 ID: ${pid[i]}` });
      }

      netTotal += product.product_price * actual_amount[i];
    }

    // 如果有傳入 coupon_id，則查詢優惠券資訊
    let discountAmount = 0;
    let couponDetailId = null;
    // 若有 coupon_id，查 coupon_use 取得 coupon_detail_id
    if (coupon_id) {
      const [couponUseRows] = await db.query(
        "SELECT coupon_detail_id FROM coupon_use WHERE coupon_id = ? AND sid = ? AND coupon_status = 0",
        [coupon_id, sid]
      );

      if (couponUseRows.length === 0) {
        return res.status(400).json({ success: false, message: "無效的優惠券或已使用" });
      }

      couponDetailId = couponUseRows[0].coupon_detail_id;

      // 查 coupon 表取得折扣金額
      const [couponRows] = await db.query(
        "SELECT discount_coins FROM coupon WHERE coupon_id = ? AND coupon_status = 0",
        [coupon_id]
      );

      if (couponRows.length === 0) {
        return res.status(400).json({ success: false, message: "優惠券無效或已被使用" });
      }

      discountAmount = Number(couponRows[0].discount_coins);

      // 更新 coupon 和 coupon_use 狀態為已使用
      await db.query("UPDATE coupon SET coupon_status = 1 WHERE coupon_id = ?", [coupon_id]);
      await db.query("UPDATE coupon_use SET coupon_status = 1 WHERE coupon_detail_id = ?", [couponDetailId]);
    }
    // 購物車金額 - 折扣 + 假運費(寫死) = 帳單總金額
    const shippingFee = 30;
    const finalPrice = Math.max(Number(netTotal) - Number(discountAmount) + shippingFee, 0);

    // 插入訂單對應db欄位
    const sql1 =
      "INSERT INTO `order_list`(`order_name`, `sid`, `order_phone`, `order_email`, `total`, `order_status`, `pay_way`, `shipping_zipcode`, `shipping_address`, `delivery_way`, `delivery_status`, `order_date`, `coupon_detail_id`, `discount_coins`) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, '宅配', '出貨中', NOW(), ? , ?)";

    const [result1] = await db.query(sql1, [
      name,
      sid,
      phone,
      email,
      finalPrice,
      pay_way,
      postcode,
      address,
      couponDetailId,
      discountAmount,
    ]);

    // 準備同時生成第2張表order_child + 同一筆oid對很多商品
    const insertedOrderId = result1.insertId;

    // 使用一個批量插入方式來提高效率
    const orderChildValues = [];

    for (let i = 0; i < pid.length; i++) {
      const product = products.find((p) => p.pid === pid[i]);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `找不到商品 ID: ${pid[i]}`,
        });
      }

      // 將插入值添加到數組中
      orderChildValues.push([
        insertedOrderId,
        pid[i],
        product.product_price, // 使用從資料庫查出的價格
        actual_amount[i],
      ]);
    }

    // 批量插入數據到 order_child 表
    // product_price是商品價格, sale_price可能是活動折扣後入庫價格
    const sql2 =
      "INSERT INTO `order_child`(`oid`, `pid`, `sale_price`, `actual_amount`) VALUES ?";

    const [result2] = await db.query(sql2, [orderChildValues]);

    output.success = true;
    output.result = {
      order_list: result1,
      order_child: result2,
    };

  } catch (ex) {
    output.exception = {
      message: ex.message,
      stack: ex.stack,
    };
  }

  res.json(output);
});

// 後端接收綠界回傳的資料
router.get("/payment/create/:oid", async (req, res) => {
  const oid = req.params.oid;

  try {
    const [[order]] = await db.query(
      "SELECT o.oid, o.total FROM order_list o WHERE o.oid = ?",
      [oid]
    );

    if (!order) {
      return res.status(404).json({ success: false, message: "找不到訂單" });
    }

    // 動態引入, 使用該api才引入
    const { default: ecpay_payment } = await import('ecpay_aio_nodejs');

    const MerchantTradeDate = new Date().toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    });

    const TradeNo = 'test' + new Date().getTime();

    let base_param = {
      MerchantTradeNo: TradeNo,
      MerchantTradeDate,
      TotalAmount: order.total.toString(),
      TradeDesc: '測試商品訂單',
      ItemName: '測試商品等',
      ReturnURL: `${HOST}/order-list/payment/return`, // real outcome to backend
      OrderResultURL: `https://petpet-shop-fronted.zeabur.app/cart/OrderSteps/paymentStatus`,
      CustomField1: String(oid),
    };

    const create = new ecpay_payment(options);

    const html = create.payment_client.aio_check_out_all(base_param, {});
    res.send(html);

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/payment/return', async (req, res) => {
  console.log('req.body:', req.body);

  const { CheckMacValue, CustomField1, RtnCode } = req.body;
  const data = { ...req.body };
  delete data.CheckMacValue; // 此段不驗證

  const create = new ecpay_payment(options);
  const checkValue = create.payment_client.helper.gen_chk_mac_value(data);
  const isValid = CheckMacValue === checkValue;

  console.log(
    '確認交易正確性：',
    isValid,
    CheckMacValue,
    checkValue,
  );

  // order_status: 0 = not yet pay
  if (isValid) {
    const oid = CustomField1;
    if (RtnCode === '1') {
      // success：order_status = 1
      const updatePaymentStatus =
        "UPDATE `order_list` SET `order_status` = 1 WHERE `oid` = ?";
      await db.query(updatePaymentStatus, [oid]);
    } else {
      // failed：order_status = 2
      const updatePaymentStatus =
        "UPDATE `order_list` SET `order_status` = 2 WHERE `oid` = ?";
      await db.query(updatePaymentStatus, [oid]);
    }
  }


  // 交易不管成功與否, 需回傳 1|OK 給綠界表示有收到資料
  res.send('1|OK');
});

// RtnCode - 綠界: 
// 10300066：「交易付款結果待確認中，請勿出貨」，請至廠商管理後台確認已付款完成再出貨。
// 10100248：「拒絕交易，請客戶聯繫發卡行確認原因」
// 10100252：「額度不足，請客戶檢查卡片額度或餘額」
// 10100254：「交易失敗，請客戶聯繫發卡行確認交易限制」
// 10100251：「卡片過期，請客戶檢查卡片重新交易」
// 10100255：「報失卡，請客戶更換卡片重新交易」
// 10100256：「被盜用卡，請客戶更換卡片重新交易」

export default router;
