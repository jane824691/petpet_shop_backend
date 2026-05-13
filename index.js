import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import logger from "morgan";
import cookieParser from "cookie-parser";
import { fileURLToPath, pathToFileURL } from "url";
import { RedisStore } from "connect-redis";
import { redisClient } from "./utils/redisClient.js";
//帶入後端分頁的路由
//const upload = multer({ dest: "tmp_uploads/" }); 暫存區
import db from "./utils/connect-mysql.js";
import registerListRouter from "./routes/register-list.js";
import couponListRouter from "./routes/coupon-list.js";
import couponListUseRouter from "./routes/coupon-list.js";
//新增&讀取資料
import productRouter from "./routes/product.js";
import commentsRouter from "./routes/comments.js";
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
    origin: ["http://localhost:3000", "http://localhost:3001", "https://localhost:9000", "https://petpet-shop-fronted.zeabur.app", "https://petpet-admin.zeabur.app", "http://127.0.0.1:5173", "http://localhost:5173"],
    // origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(cookieParser());
app.use(express.static("public"));
app.use("/bootstrap", express.static("node_modules/bootstrap/dist"));
app.use("/jquery", express.static("node_modules/jquery/dist"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const sessionStore = new RedisStore({
  client: redisClient,
  prefix: "sess:",
});

app.use(
  session({
    name: "sid",
    saveUninitialized: false,
    resave: false,
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    cookie: {
      httpOnly: true,
      // secure: process.env.NODE_ENV === "production", // https 才設 true
      secure: false, // https 才設 true
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 3, // 3 天
    },
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
    const token = auther.slice(7); // 如果有，去掉 "Bearer "，Bearer後面必須空格
    // 避免token亂給，出錯提示
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      // 將 payload 存儲在 res.locals 中，以便後續使用
      res.locals.jwt = payload;
    } catch (ex) {
      console.error(" JWT驗證失敗:", ex);
    }
  }

  next(); //往下傳遞req, res物件
});

// 自訂頂層 middleware

app.use("/register-list", registerListRouter);
app.use("/product", productRouter);
app.use("/comments", commentsRouter);
app.use("/order-list", orderListRouter);
app.use("/coupon-show", couponShowRouter);
app.use("/coupon-list", couponListRouter);
app.use("/coupon-list/coupon-use", couponListUseRouter);
app.use("/member", membercenterRouter);


app.post("/login-jwt", async (req, res) => {
  const output = {
    success: false,
    code: 0,
    postData: req.body,
    sid: 0,
    account: "",
    token: "",
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
  // output.token = jwt.sign({ sid: row.sid, account: row.account, expiresIn: '600s'}, process.env.JWT_SECRET);
  output.token = jwt.sign(
    { sid: row.sid, account: row.account },
    process.env.JWT_SECRET,
    // { expiresIn: '7200s' } // 在這裡設置過期時間
  );
  req.session.user = {
    sid: row.sid,
    account: row.account,
  };
  res.json(output);
});

app.get("/auth/check", (req, res) => {
  const user = req.session?.user;
  if (!user?.sid) return res.status(401).json({ success: false, code: 401 });
  return res.json({ success: true, code: 200, sid: user.sid, account: user.account });
});

app.post("/logout", (req, res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  req.session?.destroy(() => {
    res.clearCookie("sid", cookieOptions);
    res.json({ success: true, code: 200 });
  });
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

const port = process.env.PORT || 3002
// const port = process.env.port || 3002;

app.listen(port, () => {
  console.log(`express server: ${port}`);
});
