// redisClient.js
import { createClient } from 'redis'

export const redisClient = createClient({
    url: process.env.REDIS_URL,
    // Node.js經過DNS解析成 IPv6會變 localhost → ::1（IPv6）
    // 故直接寫 127.0.0.1（IPv4）

    // username: 'default',
    // password: '*******',
    // socket: {
    //     host: 'cushion-forward-men-90917.db.redis.io',
    //     port: 19224
    // }
})

redisClient.on('connect', () => {
    console.log('Redis connected')
})

redisClient.on('error', (err) => {
    console.error('Redis Error', err)
})

await redisClient.connect()
// await redisClient.set('foo', 'bar');
// const result = await client.get('foo');
// console.log(result)  // >>> bar