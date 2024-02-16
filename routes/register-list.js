import express from "express";
import db from "./../utils/connect-mysql.js"; //當前位置再回上一層
import upload from "./../utils/upload-imgs.js";
import dayjs from "dayjs";
import bcrypt from "bcryptjs";
// import multer from "multer";

const router = express.Router();

// 設定 multer 上傳的存儲引擎和路徑
// const storage = multer.memoryStorage();  // 這裡使用 memoryStorage()，也可以設定其他存儲方式
// const upload = multer({ storage: storage });

//會員註冊(新增資料)
router.use((req, res, next) => {
  const u = req.url.split("?")[0]; // 只要路徑
  console.log({ u });
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
  let keyword_ = db.escape(`%${keyword}%`); // 跳脫

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
    where += ` AND ( \`name\` LIKE ${keyword_} OR \`mobile\` LIKE ${keyword_} ) `;
  }

  if (startDate){
    qs.startDate = startDate;
    where += ` AND birthday >= '${startDate}' `; //拿到的startDateD.format("YYYY-MM-DD")加引號
  }
  if (endDate) {
    qs.endDate = endDate;
    where += ` AND birthday <= '${endDate}' `;
  }

//console.log(where)

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

  const t_sql = `SELECT COUNT(1) totalRows FROM address_book ${where}`;
  [[{ totalRows }]] = await db.query(t_sql);
  totalPages = Math.ceil(totalRows / perPage);
  if (totalRows > 0) {
    if (page > totalPages) {
      output.redirect = `?page=${totalPages}`;
      output.info= `頁碼值大於總頁數`;
      return { ...output, totalRows, totalPages };
    }

    const sql = `SELECT * FROM address_book ${where} ORDER BY sid DESC 
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

  // router.get("/add", async (req, res) => {
  //   res.render('address-book/add');
  // });

  //可以解析multipart/form-data
  router.post("/add",upload.single('photo'), async (req, res) => {
    const output = {
      success: false,
      postData: req.body, // 除錯用
    };
    

    //塞資料第一種用法
    const {lastname, firstname, email, mobile, birthday, account, password, identification, zipcode, address, photo,township,country} = req.body;
    
    //加鹽放入資料庫
    const hash = await bcrypt.hash(password, 8);

  // 塞資料前使用 bcrypt 對密碼進行加密
  //const password = await bcrypt.hash(password, 8);
  
  const sql = "INSERT INTO `profile`(`lastname`,`firstname`, `email`, `mobile`, `birthday`, `account`,`password`,`identification`, `country`,`township`,`zipcode`,`address`,`photo`,`created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,NOW() )";
  //塞入對應欄位的?值並顯示當前建立時間
  console.log('eddie',req.file);
  try {
  const [result] = await db.query(sql, 
    [ lastname, 
      firstname, 
      email, 
      mobile, 
      birthday,
      account,
      hash, 
      identification,
      country,
      township,
      zipcode,
      address,
      req.file.filename //圖片是否存在
    ]);
    output.result = result;
    output.success = !! result.affectedRows; //資料正確的話執行 (轉換布林值)

  } catch (ex) {
    // output.exception = ex; //資料錯誤的話執行
    output.exception = {
      message: ex.message,
      stack: ex.stack,
    };
  }

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

console.log(output);
  res.json(output);
  });

  router.get("/edit/:sid", async (req, res) => {
  const sid = +req.params.sid;
  res.locals.title = "編輯 | " + res.locals.title;

  const sql = `SELECT * FROM address_book WHERE sid=?`;
  const [rows] = await db.query(sql, [sid]);
  if (!rows.length) {
    return res.redirect(req.baseUrl);
  }
  const row = rows[0];
  row.birthday2 = dayjs(row.birthday).format("YYYY-MM-DD");

  res.render("address-book/edit", row);
});

  // 取得單筆的資料
router.get("/api/edit/:sid", async (req, res) => {
  const sid = +req.params.sid;

  const sql = `SELECT * FROM address_book WHERE sid=?`;
  const [rows] = await db.query(sql, [sid]);
  if (!rows.length) {
    return res.json({success: false});
  }
  const row = rows[0];
  row.birthday = dayjs(row.birthday).format("YYYY-MM-DD");

  res.json({success: true, row});
});

router.put("/edit/:sid", async (req, res) => {
  const output = {
    success: false,
    postData: req.body,
    result: null,
  };

    //TODO: 表單資料檢查
    //trim(),避免<textarea>換行塞值
    req.body.address = req.body.address.trim(); // 去除頭尾空白
    const sql = `UPDATE address_book SET ? WHERE sid=?`;
    const [result] = await db.query(sql, [req.body, req.body.sid]);
    output.result = result;
    output.success = !!result.changedRows; //轉成布林值

    res.json(output);
  });

  router.delete("/:sid", async (req, res) => {
    const output = {
      success: false,
      result: null,
    };
    const sid = + req.params.sid;
    if (!sid || sid < 1) { //如果不是數值或是負值的話就不做了
      return res.json(output);
    }

    const sql = ` DELETE FROM address_book WHERE sid=${sid}`;
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
  const sql = "SELECT * FROM address_book ORDER BY sid DESC LIMIT 5";
  const [rows] = await db.query(sql);
  res.json(rows);
  */