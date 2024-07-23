import mysql from "mysql2/promise";

const {DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT} =process.env;
console.log({DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT});
// const db =await mysql.createPool({ //node的await不用async的樣子11/16,10:17
const db =await createPool({
host: DB_HOST,
user: DB_USER,
password: DB_PASS,
database: DB_NAME,
port: DB_PORT,
waitForConnections:true,
connectionLimit: 5,
queueLimit:0,
});

export default db;


//連接資料庫