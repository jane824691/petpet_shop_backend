import bcrypt from "bcryptjs";

const hash = "$2a$08$GtG.Tz8GGJwRieOq01gQP.e/UEXZA8tWXtO8aebOtpFrRb2guGdjW"; //把hash內容丟進資料庫的password就可登入

console.log( await bcrypt.compare("LH1234567", hash) ); //正確密碼是LH123456


/*
產生雜湊碼及檢查true or false
node src\bcrypt-hash.js
node src\bcrypt-compare.js
*/