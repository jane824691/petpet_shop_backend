import express from "express";
import db from "../utils/connect-mysql.js";
import upload from "../utils/upload-imgs.js";
import dayjs from "dayjs";

const router = express.Router();

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
  if(res.locals.jwt?.id){
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
      info: ""
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
    netTotal,
    pay_way,
    postcode,
    address,
  } = req.body;

  try {
    const sql1 =
    "INSERT INTO `order_list`(`order_name`, `sid`, `order_phone`, `order_email`, `total`, `order_status`, `pay_way`, `shipping_zipcode`, `shipping_address`, `delivery_way`, `delivery_status`, `order_date`) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, '宅配', '出貨中', CONVERT_TZ(NOW(), '+00:00', '+08:00'))";
  
    const [result1] = await db.query(sql1, [
      name,
      sid,
      phone,
      email,
      netTotal,
      pay_way,
      postcode,
      address,
    ]);


    // 準備同時生成第2張表order_child + 同一筆oid對很多商品
    const insertedOrderId = result1.insertId;

    const { pid, sale_price, actual_amount } = req.body;

    let result2;  // 在這裡宣告 result2

    if (Array.isArray(pid) && Array.isArray(sale_price) && Array.isArray(actual_amount) &&
        pid.length === sale_price.length && sale_price.length === actual_amount.length) {

      const sql2 =
        "INSERT INTO `order_child`(`oid`, `pid`, `sale_price`, `actual_amount`) VALUES (?, ?, ?, ?)";

      for (let i = 0; i < pid.length; i++) {
        [result2] = await db.query(sql2, [insertedOrderId, pid[i], sale_price[i], actual_amount[i]]);
      }

      output.result = {
        order_list: result1,
        order_child: result2,
      };

      output.success = !!result1.affectedRows && !!result2.affectedRows;
    } else {
      // Handle case where pid, sale_price, and actual_amount are not arrays or have different lengths
      output.success = !!result1.affectedRows;
      output.result = { order_list: result1 };
    }
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
    WHERE o.oid IN (SELECT oid FROM order_child) AND o.oid = ${ oid };`
  );
  if (rows.length) return res.json(rows); // 直接回傳所有資料
  else return res.json({});
});


export default router;
