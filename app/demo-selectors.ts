import { members, plans } from './demo-data'
import type { State } from './repository'

export function demoSelectors(state: State) {
  const visible = () => members.filter(p => !state.blocked.includes(p.id))
  const member = (id:string) => visible().find(p => p.id === id)
  const likesFrom = () => state.likes.filter(l => l.to === 'self').map(l => l.from)
  const likesTo = () => state.likes.filter(l => l.from === 'self').map(l => l.to)
  const hasMatch = (id:string) => state.matches.some(m => m.memberId === id) && Boolean(member(id))
  const currentPlan = () => plans.find(p => p.id === state.account?.plan) ?? plans[0]
  return { visible, member, likesFrom, likesTo, hasMatch, currentPlan }
}
