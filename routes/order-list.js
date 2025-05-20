import express from "express";
import db from "../utils/connect-mysql.js";
import upload from "../utils/upload-imgs.js";
import dayjs from "dayjs";
import ecpay_payment from 'ecpay_aio_nodejs';
// import dotenv from "dotenv";
// dotenv.config();

// const HOST = process.env.HOST || 'http://localhost:3002';
// const ecpay_payment = require('ecpay_aio_nodejs');
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

router.get("/person/:sid", async (req, res) => {
  try {
    let sid = req.params.sid || 1; // 使用 req.params.sid 來獲取路徑參數
    const [rows, fields] = await db.query(
      `SELECT * FROM order_list WHERE sid=${sid} ORDER BY oid DESC`
    );

    let output = {
      success: true,
      page: 1,
      perPage: 6,
      rows: rows,
      totalRows: rows.length,
      totalPages: 1,
      qs: {},
      redirect: "",
      info: "",
    };

    res.json(output);
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
    if (coupon_id) {
      const [coupon] = await db.query(
        "SELECT discount_coins FROM coupon WHERE coupon_id = ? AND coupon_status = 0",
        [coupon_id]
      );

      // 如果優惠券不存在或已使用，回傳錯誤
      if (coupon.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "無效的優惠券或優惠券已使用" });
      }

      // 更新優惠券table狀態為已使用
      // coupon_status: 0 = init, 1 = used, 2 = expired
      const updateCouponSql =
        "UPDATE `coupon` SET `coupon_status` = 1 WHERE `coupon_id` = ?";
      await db.query(updateCouponSql, [coupon_id]);
      const updateCouponUseSql =
        "UPDATE coupon_use SET `coupon_status` = 1 WHERE `coupon_id` = ?";
      await db.query(updateCouponUseSql, [coupon_id]);

      // 計算折扣後金額
      discountAmount = Number(coupon[0].discount_coins); // [ { discount_coins: 50 } ]
    }

    // 購物車金額 - 折扣 + 假運費(寫死) = 帳單總金額
    const shippingFee = 30;
    const finalPrice = Math.max(Number(netTotal) - Number(discountAmount) + shippingFee, 0);

    // 插入訂單對應db欄位
    const sql1 =
      "INSERT INTO `order_list`(`order_name`, `sid`, `order_phone`, `order_email`, `total`, `order_status`, `pay_way`, `shipping_zipcode`, `shipping_address`, `delivery_way`, `delivery_status`, `order_date`) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, '宅配', '出貨中', NOW())";

    const [result1] = await db.query(sql1, [
      name,
      sid,
      phone,
      email,
      finalPrice, // 插入計算後的金額
      pay_way,
      postcode,
      address,
      pid,
      actual_amount,
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

router.get("/one/:oid", async (req, res) => {
  let oid = +req.params.oid || 1;
  const [rows, fields] = await db.query(
    `SELECT DISTINCT o.sid, o.order_name, o.total, o.order_phone, o.order_email, o.shipping_zipcode, o.shipping_address, o.pay_way, p.pid, p.product_name, p.product_img, c.sale_price, c.actual_amount
    FROM order_list o
    INNER JOIN order_child c ON c.oid = o.oid
    INNER JOIN product p ON p.pid = c.pid
    WHERE o.oid IN (SELECT oid FROM order_child) AND o.oid = ${oid};`
  );
  if (rows.length) return res.json(rows); // 直接回傳所有資料
  else return res.json({});
});

router.get("/payment/create/:oid", async (req, res) => {
  const oid = req.params.oid;

  try {
    // 撈訂單資訊
    const [[order]] = await db.query(
      "SELECT o.oid, o.total, o.order_name, o.order_email FROM order_list o WHERE o.oid = ?",
      [oid]
    );

    if (!order) {
      return res.status(404).json({ success: false, message: "找不到訂單" })
    }
    // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // if (!order.order_email || typeof order.order_email !== 'string' || !emailRegex.test(order.order_email)) {
    //   return res.status(400).json({ success: false, error: 'Email 欄位不存在或格式不正確' });
    // }

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
    console.log('MerchantTradeDate', MerchantTradeDate);

    TradeNo = 'test' + new Date().getTime();
    let base_param = {
      MerchantTradeNo: TradeNo, // 帶20碼uid, ex: f0a0d7e9fae1bb72bc93
      MerchantTradeDate,
      TotalAmount: order.total.toString(),
      TradeDesc: '測試商品訂單',
      ItemName: '測試商品等',
      ReturnURL: `${HOST}/return`,
      ClientBackURL: `${HOST}/clientReturn`,
      // Email: order.order_email.trim(),
      // PaymentType: 'aio',
      // ChoosePayment: 'ALL'
    };
    console.log('base_param', base_param);
    // console.log('order', order);
    // console.log('order_email', order.order_email);
    // console.log(typeof order.order_email)
    const create = new ecpay_payment(options);

    // 注意：在此事直接提供 html + js 直接觸發的範例，直接從前端觸發付款行為
    const html = create.payment_client.aio_check_out_all(base_param, {});

    console.log('html', html);

    res.render('index', {
      title: 'Express',
      html,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
})

// 後端接收綠界回傳的資料
router.post('/return', async (req, res) => {
  console.log('req.body:', req.body);

  const { CheckMacValue } = req.body;
  const data = { ...req.body };
  delete data.CheckMacValue; // 此段不驗證

  const create = new ecpay_payment(options);
  const checkValue = create.payment_client.helper.gen_chk_mac_value(data);

  console.log(
    '確認交易正確性：',
    CheckMacValue === checkValue,
    CheckMacValue,
    checkValue,
  );

  // 交易成功後，需要回傳 1|OK 給綠界
  res.send('1|OK');
});

// 用戶交易完成後的轉址
router.get('/clientReturn', (req, res) => {
  console.log('clientReturn:', req.body, req.query);
  res.render('return', { query: req.query });
});

export default router;
