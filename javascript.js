// cloudflare-worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // ตรวจสอบว่าเป็น method GET
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const url = new URL(request.url)
  const tiktokUrl = url.searchParams.get('url')

  // ตรวจสอบว่ามี URL parameter
  if (!tiktokUrl) {
    return new Response(JSON.stringify({ error: 'Missing TikTok URL parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // เรียก TikTok API
  try {
    const apiResponse = await fetch(`https://tiktok-video-no-watermark2.p.rapidapi.com/?url=${encodeURIComponent(tiktokUrl)}`, {
      headers: {
        'X-RapidAPI-Key': 'e1fe9f5e84mshc2af2c71e5afe63p157397jsnc717460c6b6c', // ควรเก็บใน Cloudflare Secrets
        'X-RapidAPI-Host': 'tiktok-video-no-watermark2.p.rapidapi.com'
      }
    })

    if (!apiResponse.ok) {
      throw new Error(`TikTok API error: ${apiResponse.status}`)
    }

    const data = await apiResponse.json()
    
    // ส่ง response กลับไปยัง client
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // อนุญาตให้ทุก domain เรียกใช้
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  }
}