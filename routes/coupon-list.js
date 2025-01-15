import express from "express";
import db from "../utils/connect-mysql.js"; //當前位置再回上一層
import upload from "../utils/upload-imgs.js";
import dayjs from "dayjs";

const router = express.Router();

router.use((req, res, next) => {
  const u = req.url.split("?")[0]; // 只要路徑
  if (req.method === "GET" && u === "/") {
    return next();
  }

  /*if (!req.session.admin) {
    return res.redirect("/login");
  }*/
  next();
});

const getListData = async (req) => {
  const perPage = 20; // 每頁幾筆
  let page = +req.query.page || 1; // 用戶決定要看第幾頁
  let keyword = (req.query.keyword && typeof req.query.keyword ==='string' ) ? req.query.keyword.trim() : "";
  let keyword_ = db.escape(`%${keyword}%`); //跳脫

  let qs = {};  // 用來把 query string 的設定傳給 template，保留搜尋框文字

  // 起始的日期
  let startDate = req.query.startDate ? req.query.startDate.trim() : "";
  const startDateD = dayjs(startDate);
  if (startDateD.isValid()) {
    startDate = startDateD.format("YYYY-MM-DD"); //dayjs轉換日期格式
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

  let where = ` WHERE 1 `; //加空格避免字元相連 ,1為sql預設(填空) 
  //分開的if,分開的變數條件(OR)
  if (keyword) {
    qs.keyword = keyword;
    where += ` AND ( \`lastname\` LIKE ${keyword_} OR \`firstname\` LIKE ${keyword_} OR \`mobile\` LIKE ${keyword_} ) `;
  }

  if (startDate){
    qs.startDate = startDate;
    where += ` AND birthday >= '${startDate}' `; //拿到的startDateD.format("YYYY-MM-DD")加引號
  }
  if (endDate) {
    qs.endDate = endDate;
    where += ` AND birthday <= '${endDate}' `;
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
    qs, //querystring
    redirect: "",
    info: "",
  };

  if(page < 1){
    // return res.redirect(req.baseUrl);
    //return res.redirect(`?page=1`);
    output.redirect= `?page=1`;
    output.info= `頁碼值小於 1`;
    return output;
  }

  const t_sql = `SELECT COUNT(1) totalRows FROM coupon ${where}`;
  [[{ totalRows }]] = await db.query(t_sql);
  totalPages = Math.ceil(totalRows / perPage);
  if (totalRows > 0) {
    if (page > totalPages) {
      output.redirect = `?page=${totalPages}`;
      output.info= `頁碼值大於總頁數`;
      return { ...output, totalRows, totalPages };
    }

    const sql = `SELECT * FROM coupon ${where} ORDER BY coupon_id DESC 
    LIMIT ${(page - 1) * perPage}, ${perPage}`;
    [rows] = await db.query(sql);
    output = { ...output, success: true, rows, totalRows, totalPages };
  }

  return output;
};

  //以EJS呈現,不可/開頭

  router.get("/", async (req, res) => {
    res.locals.pageName = "ab-list";
    res.locals.title = "列表 | " + res.locals.title;
    const output = await getListData(req);
    if (output.redirect){
      return res.redirect(output.redirect);
    }
  
    if (!req.session.admin) {
      res.render("address-book/list-no-admin", output);
    } else {
      res.render("address-book/list", output);
    }
  });
  
  router.get("/api", async (req, res) => {
    res.json(await getListData(req));
    /*
    //暫時註解掉，啟用token功能時需打開
    // ?表示不確定有沒有jwt(但確定有前面屬性)，若有jwt&後面屬性就給資料。
    if(res.locals.jwt?.id){
      return res.json(await getListData(req));
    } else {
      return res.json({success: false, error: "沒有授權, 不能取得資料"});
    }
    */
  });


  router.post("/add", upload.none(), async (req, res) => {

    const output = {
      success: false,
      postData: req.body, // 除錯用
    };
  
    // 假設 coupon 表格中有 coupon_id、hash、discount_coins、expiry_date、coupon_status 欄位
    const { hash, discount_coins, expiry_date, coupon_status, sid } = req.body;
    
    const sql = `
      INSERT INTO \`coupon\` (\`hash\`, \`discount_coins\`, \`created_at\`, \`expiry_date\`, \`coupon_status\`)
      VALUES (?, ?, NOW(), ?, ?);
    `;
  try{
    const values = [hash, discount_coins, expiry_date, coupon_status];
    const [couponResult] = await db.query(sql, values);
    output.couponResult = couponResult;


    output.success = !!couponResult.affectedRows ;
  } catch (ex) {
    output.exception = ex;
  }

  res.json(output);
});
  
//含上傳圖片
router.post("/coupon-use/add", upload.none(), async (req, res) => {

  const output = {
    success: false,
    postData: req.body, // 除錯用
  };

  // 假設 coupon 表格中有 coupon_id、hash、discount_coins、expiry_date、coupon_status 欄位
  const { coupon_id, sid } = req.body;
  const status = 0;
  const sql = `
    INSERT INTO \`coupon_use\` (\`coupon_id\`, \`sid\`, \`coupon_status\`, \`created_at3\`)
    VALUES (?, ?, ?, NOW());
  `;
  const values = [coupon_id, sid, status ];

  const [couponUseResult] = await db.query(sql, values);
  output.couponUseResult = couponUseResult;

try{
  const values = [hash, discount_coins, expiry_date, coupon_status];
  const [couponResult] = await db.query(sql, values);
  output.couponResult = couponResult;

  output.success = !!couponResult.affectedRows && !!couponUseResult.affectedRows;
} catch (ex) {
  output.exception = ex;
}

res.json(output);
});

  

  // router.post("/add",upload.none(), async (req, res) => {
    // const output = {
    //   success: false,
    //   postData: req.body, // 除錯用
    // };
    

  //塞資料第一種用法
//   const {hash, discount_coins, created_at, expiry_date, coupon_status} = req.body;
//   const sql = `
//   INSERT INTO \`coupon\` (\`hash\`, \`discount_coins\`, \`created_at\`,\`expiry_date\`, \`coupon_status\`)
//   SELECT \`coupon_use\`.\`hash\`, \`coupon_use\`.\`discount_coins\`, NOW(), \`coupon_use\`.\`expiry_date\`, \`coupon_use\`.\`coupon_status\`
//   FROM \`coupon_use\`
//   WHERE \`coupon_use\`.\`coupon_id\` = ?;
// `;

// 使用此 SQL 查詢時，使用預備語句的方式傳入相應的值
// const values = [your_hash_value, your_discount_coins_value, your_coupon_status_value, your_expiry_date_value];


  //塞入對應欄位的?值並顯示當前建立時間
  

  // try {
  // const [result] = await db.query(sql, 
  //   [ hash, 
  //     discount_coins, 
  //     created_at, 
  //     coupon_status, 
  //     expiry_date, 
  //   ]);
  //   output.result = result;
  //   output.success = !! result.affectedRows; //資料正確的話執行 (轉換布林值)

  // } catch (ex) {
  //   output.exception = ex; //資料錯誤的話執行
  // }

  //塞資料第二種用法
  /*const sql = "INSERT INTO `address_book` SET ?";   //全部欄位塞?值再填入
  // INSERT INTO `address_book` SET `name`='abc',
  req.body.created_at = new Date(); //因資料顯示不正確(0000-00-00)，created_at欄位手動添加
  const[result] = await db.query(sql, [req.body]);
  */

  /*
  {
    "fieldCount": 0,
    "affectedRows": 1,  # 影響的列數(新增/刪除)
    "insertId": 1021,   # 取得的 PK (訂單編號)
    "info": "",
    "serverStatus": 2,
    "warningStatus": 0,
    "changedRows": 0    # 修改時真正有變動的資料筆數
  }
  */

  // res.json(output);
  // });

  router.get("/edit/:coupon_id", async (req, res) => {
  const coupon_id = +req.params.coupon_id;
  res.locals.title = "編輯 | " + res.locals.title;

  const sql = `SELECT * FROM coupon WHERE coupon_id=?`;
  const [rows] = await db.query(sql, [coupon_id]);
  if (!rows.length) {
    return res.redirect(req.baseUrl);
  }
  const row = rows[0];
  row.birthday2 = dayjs(row.birthday).format("YYYY-MM-DD");

  res.render("address-book/edit", row);
});

  // 取得單筆的資料
router.get("/api/edit/:coupon_id", async (req, res) => {
  const coupon_id = +req.params.coupon_id;

  const sql = `SELECT * FROM coupon WHERE coupon_id=?`;
  const [rows] = await db.query(sql, [coupon_id]);
  if (!rows.length) {
    return res.json({success: false});
  }
  const row = rows[0];
  row.birthday = dayjs(row.birthday).format("YYYY-MM-DD");

  res.json({success: true, row});
});

router.put("/edit/:coupon_id", async (req, res) => {
  const output = {
    success: false,
    postData: req.body,
    result: null,
  };

    //TODO: 表單資料檢查
    //trim(),避免<textarea>換行塞值
    req.body.address = req.body.address.trim(); // 去除頭尾空白
    const sql = `UPDATE coupon SET ? WHERE coupon_id=?`;
    const [result] = await db.query(sql, [req.body, req.body.coupon_id]);
    output.result = result;
    output.success = !!result.changedRows; //轉成布林值

    res.json(output);
  });

  router.delete("/:coupon_id", async (req, res) => {
    const output = {
      success: false,
      result: null,
    };
    const coupon_id = + req.params.coupon_id;
    if (!coupon_id || coupon_id < 1) { //如果不是數值或是負值的話就不做了
      return res.json(output);
    }

    const sql = ` DELETE FROM coupon WHERE coupon_id=${coupon_id}`;
    const [result] = await db.query(sql);
    output.result = result;
    output.success = !! result.affectedRows; //轉成boolean
    res.json(output);
  });
  export default router;


  //upload.single(),upload.array(),upload.any(),upload.none()
  //表單送出的三種格式:urlencoded,multipart/form-data,json

  /*第一種處理法
  router.post("/add", upload.none(), async (req, res) => { //此為multipart/form-data格式，需特別處理
    res.json(req.body);
  });
  */

  /*第二種&第三種處理法
  router.post("/add", async (req, res) => { //此為urlencoded&Json格式
    res.json(req.body);
  });
  */

  /*
  const sql = "SELECT * FROM address_book ORDER BY coupon_id DESC LIMIT 5";
  const [rows] = await db.query(sql);
  res.json(rows);
  */