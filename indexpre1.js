import "dotenv/config";
//引入之後可以讓我們找到其他檔案的變數?
//載入.env這個檔案的設定

import express from "express";

const app =express();
// 呼叫express

app.get("/",(req, res)=>{
//express的requset跟express的response，定義路由，用get方法才能拜訪，post不行
    res.send(`<h2>aassaa1a</h2>`);
//可以res.send也可以res.end一個讓網頁顯示html，一個就是顯示文字
//懂了!!res那裏就是回應.方式!!!!!
});


const port =process.env.WEB_PROT || 3001;
//把.env檔案的設定import進來後，就可以拿來用
//為什麼我顯示 不是3002!!!?

app.listen(port, ()=>{
    console.log(`express server ${port}`);
});