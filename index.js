import "dotenv/config";
import express from "express";
import session from "express-session";
import dayjs from "dayjs";
import moment from "moment-timezone";
import cors from "cors";
import mysql_session from "express-mysql-session";
import bcrypt from "bcryptjs";
import sales from "./data/sales.json" assert { type: "json" };
import jwt from "jsonwebtoken";
import path from "path";
import logger from "morgan";
import cookieParser from "cookie-parser";
import { fileURLToPath, pathToFileURL } from "url";
//import multer from "multer";
//帶入後端分頁的路由
//const upload = multer({ dest: "tmp_uploads/" }); 暫存區
import upload from "./utils/upload-imgs.js";
import db from "./utils/connect-mysql.js";
import registerListRouter from "./routes/register-list.js";
import admin2Router from "./routes/admin2.js";
import couponListRouter from "./routes/coupon-list.js";
import couponListUseRouter from "./routes/coupon-list.js";
//新增&讀取資料
import productRouter from "./routes/product.js";
import orderListRouter from "./routes/order-list.js";
import membercenterRouter from "./routes/member.js";
import couponShowRouter from "./routes/coupon-show.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.set("view engine", "ejs"); //ejs介紹 https://medium.com/@charming_rust_oyster_221/ejs-%E5%85%A7%E5%B5%8C%E5%BC%8F%E7%9A%84%E6%A8%A3%E6%9D%BF%E5%BC%95%E6%93%8E-%E7%AD%86%E8%A8%98-482d83c73887
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
// top-level middlewares
app.use(
  cors({
    origin: ["http://localhost:3000", "https://localhost:9000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(logger("dev"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(cookieParser());
app.use(express.static("public"));
app.use("/bootstrap", express.static("node_modules/bootstrap/dist"));
app.use("/jquery", express.static("node_modules/jquery/dist"));
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const MysqlStore = mysql_session(session); //session資料存放資料庫
const sessionStore = new MysqlStore({}, db); //session資料存放資料庫
app.use(
  session({
    saveUninitialized: false,
    resave: false,
    store: sessionStore,
    secret: "kdgdf9485498KIUGLKIU45490",
  })
);

// 定義路由處理器
app.head('/', (req, res) => {
  res.status(200).send('Hello from HEAD /');
});

// 自訂頂層 middleware

app.use((req, res, next) => {

  // 取得某一個 http header(express request.get())
  const auther = req.get("Authorization");
  // 查看是否有"Bearer "，有的話就切掉
  if (auther && auther.indexOf("Bearer ") === 0) {
    console.log(auther);
    const token = auther.slice(7); // 如果有，去掉 "Bearer "，Bearer後面必須空格
    // 避免token亂給，出錯提示
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      console.log({ payload });
      // 將 payload 存儲在 res.locals 中，以便後續使用
      res.locals.jwt = payload;
    } catch (ex) {
      console.error(" JWT驗證失敗:", ex);
    }
  }

  // 測試用，不用登入&token就可取得資料(等於不用登入就可查看資料)
  //res.locals.jwt = { sid: 1, account: "LittleHao" };

  next(); //往下傳遞req, res物件
});

// 自訂頂層 middleware

app.use(cors());
app.use("/register-list", registerListRouter);
app.use("/admins", admin2Router);
app.use("/product", productRouter);
app.use("/order-list", orderListRouter);
app.use("/coupon-show", couponShowRouter);
app.use("/coupon-list", couponListRouter);
app.use("/coupon-list/coupon-use", couponListUseRouter);
app.use("/member", membercenterRouter);

//後端server的fetch拿資料，不受瀏覽器cors影響
app.get("/yahoo", async (req, res) => {
  const r = await fetch("https://tw.yahoo.com/");
  const txt = await r.text();
  res.send(txt);
});

  // 檢查欄位驗證
app.post("/check", async (req, res) => {
  const { account } = req.body;
  const newErrors = {
    account: null,
  };

  // 檢查帳號
  if (!account.trim()) {
    newErrors.account = "帳號未填寫";
  } else {
    // 如果帳號填寫了，進行資料庫查詢
    const query = `SELECT * FROM profile WHERE account = ?`;
    connection.query(query, [account], (error, results) => {
      if (error) {
        return res
          .status(500)
          .json({ success: false, code: 500, errors: ["伺服器錯誤"] });
      }

      if (results.length > 0) {
        // 如果查詢結果存在，代表帳號已經存在
        newErrors.account = "帳號已存在";
      }

      // 最後檢查是否有錯誤
      if (newErrors.account) {
        return res
          .status(400)
          .json({ success: false, code: 400, errors: newErrors });
      } else {
        // 如果帳號沒有問題，繼續檢查其他欄位

        // 最終如果都沒有錯誤，回傳成功訊息
        return res
          .status(200)
          .json({ success: true, code: 200, message: "欄位檢查通過" });
      }
    });
  }
});

app.post("/login", async (req, res) => {
  //回傳內容
  const output = {
    success: false,
    code: 0,
    postData: req.body,
  };
  // 比對資料表
  if (!req.body.account || !req.body.password) {
    // 資料不足
    output.code = 410;
    return res.json(output);
  }
  const sql = "SELECT * FROM profile WHERE account=?";
  const [rows] = await db.query(sql, [req.body.account]);

  if (!rows.length) {
    // 帳號是錯的
    output.code = 400;
    return res.json(output);
  }
  const row = rows[0];
  //用戶送過來的密碼跟password(hash)比對
  const pass = await bcrypt.compare(req.body.password, row.profile.password);
  if (!pass) {
    // 密碼是錯的
    output.code = 420;
    return res.json(output);
  }
  output.code = 200; //自定義
  output.success = true;

});
app.get("/logout", async (req, res) => {
  delete req.session.admin;
  res.redirect("/");
});

// http://localhost:3002/try-jwt1 可以拿到token
// 重新載入後會再包含iat(建立token時間點)，所以token會變
app.get("/try-jwt1", async (req, res) => {
  // jwt 加密
  // 第二個參數是加密的key(JWT_SECRET)
  const token = jwt.sign(
    { sid: 1, account: "LittleHao" },
    process.env.JWT_SECRET
  );

  res.json({ token });
});

// http://localhost:3002/try-jwt2 可以拿到解密的資料
app.get("/try-jwt2", async (req, res) => {
  // jwt 解密
  const token =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzaWQiOjEsImFjY291bnQiOiJMaXR0bGVIYW8iLCJpYXQiOjE3MDQ2OTkxNzZ9.rNFOzTQVmB7O-KHEES9aof6F468ki_pl4omUiouvz3g";

  const payload = jwt.verify(token, process.env.JWT_SECRET);
  res.json({ payload });
});

app.post("/login-jwt", async (req, res) => {
  const output = {
    success: false,
    code: 0,
    postData: req.body,
    sid: 0,
    account: "",
    token: "",
  };
  if (!req.body.account || !req.body.password) {
    // 資料不足
    output.code = 410;
    return res.json(output);
  }
  const sql = "SELECT * FROM profile WHERE account=?";
  const [rows] = await db.query(sql, [req.body.account]);
  if (!rows.length) {
    // 帳號是錯的
    output.code = 400;
    return res.json(output);
  }
  const row = rows[0];
  const pass = await bcrypt.compare(req.body.password, row.password);
  if (!pass) {
    // 密碼是錯的
    output.code = 420;
    return res.json(output);
  }
  //回應給前端
  output.code = 200;
  output.success = true;
  output.sid = row.sid;
  output.account = row.account;
    //expiresIn(自動登出時間)
    output.token = jwt.sign({ sid: row.sid, account: row.account,expiresIn: '600s'}, process.env.JWT_SECRET);
  res.json(output);
});

//把token傳過來
app.get("/check", async (req, res) => {
  //res.locals.jwt: {id, account}
  const output = {
    success: false,
    error: "",
    data: {},
  };
  //沒找到jwt&id就顯示沒有權限並回傳資料
  if (!res.locals.jwt?.sid) {
    output.error = "沒有權限";
    return res.json(output);
  }

  const [rows] = await db.query(
    `
  SELECT
    coupon.\`hash\`,
    coupon.\`discount_type\`,
    coupon.\`expiry_date\`,
    coupon.\`coupon_status\`,
    coupon.\`created_at\`
  FROM
    \`coupon\`
  JOIN
    \`coupon_use\` ON coupon.\`coupon_id\` = coupon_use.\`coupon_id\`
  WHERE
    coupon_use.\`sid\` = ?;
`,
    [res.locals.jwt.sid]
  );

  if (!rows.length) {
    output.error = "沒有這個會員";
    //回傳資料
    return res.json(output);
  }
  //正常取得資料的情形
  output.success = true;
  output.data = rows[0];
  res.json(output);
});

//把token傳過來
app.get("/register-all", async (req, res) => {
  //res.locals.jwt: {id, account}
  const output = {
    success: false,
    error: "",
    data: {},
  };
  //沒找到jwt&id就顯示沒有權限並回傳資料
  if (!res.locals.jwt?.sid) {
    output.error = "沒有權限";
    return res.json(output);
  }
  //取得會員自身資料(有可能沒拿到)
  //因為sql語法``可能會有跳脫問題，所以外層用""包住
  const [rows] = await db.query(
    "SELECT `sid`, `lastname`, `firstname`, `birthday`, `mobile`, `account`,`password`,`zipcode`,`address`,`identification`,`email` FROM profile WHERE sid=?",
    [res.locals.jwt.sid]
  );
  if (!rows.length) {
    output.error = "沒有這個會員";
    //回傳資料
    return res.json(output);
  }
  //正常取得資料的情形
  output.success = true;
  output.data = rows[0]; //只有一筆
  res.json(output);
});

// 設定靜態內容的資料夾 /根目錄
app.use("/", express.static("public"));
app.use("/bootstrap", express.static("node_modules/bootstrap/dist"));
app.use("/jquery", express.static("node_modules/jquery/dist"));

/* *************** 404 page *** 所有的路由都要放在此之前
http://localhost:3002/index.js */
app.use((req, res) => {
  res.status(404).send(`<h1>你迷路了嗎</h1>`);
});

const port = process.env.WEB_PORT || 30553;

app.listen(port, () => {
  console.log(`express server: ${port}`);
});
