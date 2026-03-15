import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Available lucide-react icon names for the model to choose from
const ICON_POOL = [
  'Wrench', 'Hammer', 'HardHat', 'Truck', 'Forklift', 'Package', 'PackageCheck',
  'ClipboardList', 'ClipboardCheck', 'ShieldCheck', 'Shield', 'Crown', 'Star',
  'Users', 'UserCog', 'UserCheck', 'HeadsetIcon', 'Headphones', 'Phone',
  'Monitor', 'Laptop', 'Printer', 'ScanLine', 'Barcode', 'QrCode',
  'Gauge', 'Activity', 'TrendingUp', 'BarChart3', 'PieChart', 'Calculator',
  'FileText', 'FolderOpen', 'Archive', 'Database', 'Server', 'Wifi',
  'Zap', 'Lightbulb', 'Settings', 'Cog', 'SlidersHorizontal',
  'Thermometer', 'Droplets', 'Flame', 'Wind', 'Snowflake',
  'Eye', 'Search', 'Microscope', 'FlaskConical', 'TestTube2', 'Beaker',
  'Stethoscope', 'Heart', 'Pill', 'Syringe', 'Ambulance',
  'GraduationCap', 'BookOpen', 'Presentation', 'School',
  'Paintbrush', 'Palette', 'Scissors', 'Ruler', 'PenTool',
  'Navigation', 'Map', 'Compass', 'Globe', 'Building2',
  'Coffee', 'UtensilsCrossed', 'ChefHat', 'Soup',
  'Anchor', 'Plane', 'Train', 'Car', 'Bike',
  'Box', 'Boxes', 'Container', 'Weight', 'Dumbbell',
  'Lock', 'Key', 'Fingerprint', 'BadgeCheck', 'Award',
  'Megaphone', 'Radio', 'Mic', 'Camera', 'Video',
  'Clock', 'Timer', 'Calendar', 'AlarmClock',
  'Sparkles', 'Wand2', 'Target', 'Crosshair', 'Focus',
  'Plug', 'Battery', 'Power', 'Cable', 'CircuitBoard',
  'Leaf', 'TreePine', 'Recycle', 'Trash2',
  'HandMetal', 'ThumbsUp', 'Smile', 'Bot', 'BrainCircuit',
]

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 503 },
    )
  }

  const { functionName } = await req.json()
  if (!functionName || typeof functionName !== 'string') {
    return NextResponse.json({ error: 'functionName required' }, { status: 400 })
  }

  try {
    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `You are a witty assistant for a workforce planning app. A user just created a new employee function/role called "${functionName}".

Do two things:

1. Pick the BEST matching icon from this list: ${ICON_POOL.join(', ')}
   Choose the one that most closely represents this job role visually.

2. Write a short, fun, slightly humorous one-liner (in Dutch) about this role. Keep it respectful but playful. Max 15 words. It should feel like a fun tooltip that makes someone smile.

Respond in exactly this JSON format, nothing else:
{"icon": "IconName", "tagline": "Your witty Dutch one-liner here"}`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[^}]+\}/)
    if (!jsonMatch) {
      return NextResponse.json({ icon: 'Sparkles', tagline: '' })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const icon = ICON_POOL.includes(parsed.icon) ? parsed.icon : 'Sparkles'
    const tagline = typeof parsed.tagline === 'string' ? parsed.tagline.slice(0, 100) : ''

    return NextResponse.json({ icon, tagline })
  } catch (err) {
    console.error('AI function-assist error:', err)
    return NextResponse.json({ icon: 'Sparkles', tagline: '' })
  }
}
