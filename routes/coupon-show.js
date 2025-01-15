import express from "express";
import db from "../utils/connect-mysql.js";
import upload from "../utils/upload-imgs.js";

const router = express.Router();

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
  
  // 查詢時for迴圈找尋比對當前時間, 同時更新已逾期的資料庫優惠券狀態欄位
  const currentTime = new Date();
  for (let coupon of rows) {
    if (currentTime > new Date(coupon.expiry_date)) {
       // 更新 coupon 表的狀態
      await db.query(
        'UPDATE coupon SET coupon_status = ? WHERE coupon_id = ?',
        [2, coupon.coupon_id]
      );
      
      // 更新 coupon_use 表的狀態
      await db.query(
        'UPDATE coupon_use SET coupon_status = ? WHERE coupon_id = ?',
        [2, coupon.coupon_id]
      );
      coupon.coupon_status = 2; // coupon_status: 0 = init, 1 = used, 2 = expired
    }
  }

  if (rows.length) return res.json(rows);
  else return res.json({});
});

router.get("/add", async (req, res) => {
  res.render("profile/add");
});

// 獲取會員資料(新增)
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

  res.json(output);
});

export default router;