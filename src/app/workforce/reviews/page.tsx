import { getCurrentContext } from '@/lib/auth/context'
import { getReviewQueue, getReviewAnalytics } from './actions'
import SkillReviewView from '@/components/workforce/SkillReviewView'

export default async function SkillReviewsPage() {
  await getCurrentContext() // ensure auth
  const [queue, analytics] = await Promise.all([
    getReviewQueue(10),
    getReviewAnalytics(),
  ])

  return <SkillReviewView initialQueue={queue} initialAnalytics={analytics} />
}
