// redisClient.js
import { createClient } from 'redis'

export const redisClient = createClient({
    url: 'redis://127.0.0.1:6379',
    // Node.js經過DNS解析成 IPv6會變 localhost → ::1（IPv6）
    // 故直接寫 127.0.0.1（IPv4）
})

redisClient.on('connect', () => {
    console.log('Redis connected')
})

redisClient.on('error', (err) => {
    console.error('Redis Error', err)
})

await redisClient.connect()