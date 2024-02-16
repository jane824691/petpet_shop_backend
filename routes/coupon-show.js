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
  /*
  if (!req.session.admin) {
    return res.redirect("/login");
  } */
  next();
});

const getListData = async (req) => {
  const perPage = 12; // 每頁幾筆
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

  let where = ` WHERE 1 `;
  if (keyword) {
    qs.keyword = keyword;
    where += ` AND ( \`name\` LIKE ${keyword_} OR \`mobile\` LIKE ${keyword_} ) `;
  }
  if (startDate) {
    qs.startDate = startDate;
    where += ` AND birthday >= '${startDate}' `;
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
    qs,
    redirect: "",
    info: "",
  };

  if (page < 1) {
    output.redirect = `?page=1`;
    output.info = `頁碼值小於 1`;
    return output;
  }

  const t_sql = `SELECT COUNT(1) totalRows FROM profile ${where}`;
  [[{ totalRows }]] = await db.query(t_sql);
  totalPages = Math.ceil(totalRows / perPage);
  if (totalRows > 0) {
    if (page > totalPages) {
      output.redirect = `?page=${totalPages}`;
      output.info = `頁碼值大於總頁數`;
      return { ...output, totalRows, totalPages };
    }

    const sql = `SELECT * FROM profile ${where} ORDER BY sid DESC 
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

//獲取優惠券資料
router.post("/", async (req, res) => {
  let sid = req.body.sid || 1;
  const [rows, fields] = await db.query(
    `SELECT * FROM coupon
    JOIN coupon_use ON coupon.coupon_id = coupon_use.coupon_id
    JOIN profile ON coupon_use.sid = profile.sid
    WHERE profile.sid = ?`,
    [sid]
  );
  if (rows.length) return res.json(rows);
  else return res.json({});
});

//獲取會員資料(新增)
router.get("/add", async (req, res) => {
  res.render("profile/add");
});
router.post("/add", upload.none(), async (req, res) => {
  const output = {
    success: false,
    postData: req.body, // 除錯用
  };

  const { sid, lastname, firstname, birthday, mobile, account, password, zipcode, address, identification, email } = req.body;
  const sql =
    "INSERT INTO `profile`(`sid`, `lastname`, `firstname`, `birthday`, `mobile`, `account`, `password`, `zipcode`, `address`, `identification`, `email`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )";

  try {
    const [result] = await db.query(sql, [
      sid,
      lastname,
      firstname,
      birthday,
      mobile,
      account,
      password,
      address,
      identification,
      email,
    ]);
    output.result = result;
    output.success = !!result.affectedRows;
  } catch (ex) {
    output.exception = ex;
  }

  /*
  const sql = "INSERT INTO address_book SET ?";
  // INSERT INTO address_book SET `name`='abc',
  req.body.created_at = new Date();
  const [result] = await db.query(sql, [req.body]);
  */

  // {
  //   "fieldCount": 0,
  //   "affectedRows": 1,  # 影響的列數
  //   "insertId": 1021,   # 取得的 PK
  //   "info": "",
  //   "serverStatus": 2,
  //   "warningStatus": 0,
  //   "changedRows": 0    # 修改時真正有變動的資料筆數
  // }

  res.json(output);
});

router.get("/edit/:sid", async (req, res) => {
  const sid = +req.params.sid;
  res.locals.title = "編輯 | " + res.locals.title;

  const sql = `SELECT * FROM profile WHERE sid=?`;
  const [rows] = await db.query(sql, [sid]);
  if (!rows.length) {
    return res.redirect(req.baseUrl);
  }
  const row = rows[0];
  // row.birthday2 = dayjs(row.birthday).format("YYYY-MM-DD");

  res.render("profile/edit", row);
});

// 取得單筆的資料
router.get("/api/edit/:sid", async (req, res) => {
  const sid = +req.params.sid;

  const sql = `SELECT * FROM profile WHERE sid=?`;
  const [rows] = await db.query(sql, [sid]);
  if (!rows.length) {
    return res.json({ success: false });
  }
  const row = rows[0];
  row.birthday = dayjs(row.birthday).format("YYYY-MM-DD");

  res.json({ success: true, row });
});

router.put("/edit/:sid", async (req, res) => {
  const output = {
    success: false,
    postData: req.body,
    result: null,
  };
  // TODO: 表單資料檢查
  req.body.address = req.body.address.trim(); // 去除頭尾空白
  const sql = `UPDATE profile SET ? WHERE sid=?`;
  const [result] = await db.query(sql, [req.body, req.body.sid]);
  output.result = result;
  output.success = !!result.changedRows;

  res.json(output);
});

router.delete("/:sid", async (req, res) => {
  const output = {
    success: false,
    result: null,
  };
  const sid = +req.params.sid;
  if (!sid || sid < 1) {
    return res.json(output);
  }

  const sql = ` DELETE FROM profile WHERE sid=${sid}`;
  const [result] = await db.query(sql);
  output.result = result;
  output.success = !!result.affectedRows;
  res.json(output);
});
export default router;