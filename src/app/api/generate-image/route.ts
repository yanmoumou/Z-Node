import { NextRequest, NextResponse } from 'next/server'

const ROLE_STYLE: Record<string, string> = {
  mipha: 'Mipha from Zelda BOTW, red Zora princess, fish-like humanoid, red skin, golden eyes, silver tiara with blue gem, elegant silver jewelry, by a beautiful blue lake with waterfalls, Zora Domain architecture',
  link: 'Link from Zelda BOTW, young Hylian boy, blonde messy hair, blue eyes, wearing blue Champion tunic, Master Sword on back, Hylian Shield, heroic pose',
  zelda: 'Princess Zelda from Zelda BOTW, young woman, long golden blonde hair, green eyes, wearing white ceremonial dress, royal elegant, Hyrule Castle background',
  daruk: 'Daruk from Zelda BOTW, massive Goron warrior, rock-like body, red beard, friendly giant, Death Mountain volcano background, lava and rocks',
  urbosa: 'Urbosa from Zelda BOTW, tall Gerudo warrior woman, dark skin, long red hair, golden jewelry and accessories, confident pose, Gerudo Desert background',
  revali: 'Revali from Zelda BOTW, Rito warrior, blue feathered bird humanoid, proud stance, Rito Village in sky background, clouds and wooden platforms'
}

export async function POST(req: NextRequest) {
  const { prompt, role } = await req.json() as { prompt: string; role: string }

  const charStyle = ROLE_STYLE[role] || 'Hyrule landscape, fantasy scenery'
  const stylePrompt = `${charStyle}, The Legend of Zelda Breath of the Wild art style, Nintendo cel-shading, anime game illustration, soft lighting, dreamy atmosphere, high quality concept art, masterpiece`

  try {
    const res = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
      },
      body: JSON.stringify({
        model: 'wanx-v1',
        input: { prompt: stylePrompt },
        parameters: { size: '1024*1024', n: 1 }
      })
    })

    const data = await res.json()
    const taskId = data.output?.task_id

    if (!taskId) {
      return NextResponse.json({ error: '任务创建失败', detail: data }, { status: 500 })
    }

    let result = null
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      
      const statusRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}` }
      })
      const statusData = await statusRes.json()
      
      if (statusData.output?.task_status === 'SUCCEEDED') {
        result = statusData.output?.results?.[0]?.url
        break
      } else if (statusData.output?.task_status === 'FAILED') {
        return NextResponse.json({ error: '生成失败', detail: statusData }, { status: 500 })
      }
    }

    if (!result) {
      return NextResponse.json({ error: '生成超时' }, { status: 504 })
    }

    return NextResponse.json({ url: result })
  } catch (e) {
    return NextResponse.json({ error: '请求失败', detail: String(e) }, { status: 500 })
  }
}
