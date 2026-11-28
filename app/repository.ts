import type { Profile } from './demo-data'
export interface Account { id:string; birth:string; gender:string; region:string; plan:string }
export interface Like { from:string; to:string }
export interface Match { memberId:string; at:string }
export interface Message { id:string; memberId:string; text:string; at:string; from:'member'|'self'; read:boolean }
export interface Booking { serviceId:string; at:string }
export interface State {
  account:Account|null; signedIn:boolean; profile:Partial<Profile>; photos:string[]
  likes:Like[]; matches:Match[]; messages:Message[]; favorites:string[]; footprints:string[]; history:string[]
  blocked:string[]; reports:{memberId:string; reason:string; at:string}[]
  verification:{ identity:string; age:string }; eventBookings:Booking[]; consultationBookings:Booking[]
  filters:Record<string,string>; notifications:{ messages:boolean; likes:boolean }; privacy:{ footprints:boolean; online:boolean }
}
export function fresh():State {
  return {
    account:null, signedIn:false, profile:{}, photos:[], likes:[{from:'akari',to:'self'},{from:'yuta',to:'self'}],
    matches:[], messages:[], favorites:[], footprints:['misaki','naoki'], history:[], blocked:[], reports:[],
    verification:{identity:'未申請',age:'未申請'}, eventBookings:[], consultationBookings:[], filters:{},
    notifications:{messages:true,likes:true}, privacy:{footprints:true,online:true},
  }
}
export interface Repository { load(): State; save(state:State):void }
export class LocalRepository implements Repository {
  private storage: Pick<Storage,'getItem'|'setItem'>
  constructor(storage: Pick<Storage,'getItem'|'setItem'>) { this.storage = storage }
  load():State {
    try { return { ...fresh(), ...JSON.parse(this.storage.getItem('sereness-v04') ?? '{}') } }
    catch { return fresh() }
  }
  save(state:State) { this.storage.setItem('sereness-v04', JSON.stringify(state)) }
}
export function sendLike(state:State, id:string, limit:number):'blocked'|'duplicate'|'limit'|'sent'|'matched' {
  if (state.blocked.includes(id)) return 'blocked'
  if (state.likes.some(l => l.from === 'self' && l.to === id)) return 'duplicate'
  if (state.likes.filter(l => l.from === 'self').length >= limit) return 'limit'
  state.likes.push({from:'self',to:id})
  if (state.likes.some(l => l.from === id && l.to === 'self')) {
    state.matches.push({memberId:id,at:new Date().toISOString()})
    state.messages.push({id:'greeting-'+id,memberId:id,text:'はじめまして！ マッチングありがとうございます。',at:new Date().toISOString(),from:'member',read:false})
    return 'matched'
  }
  return 'sent'
}
export function block(state:State,id:string) {
  if (!state.blocked.includes(id)) state.blocked.push(id)
  state.matches = state.matches.filter(m => m.memberId !== id)
  state.likes = state.likes.filter(l => l.from !== id && l.to !== id)
  state.messages = state.messages.filter(m => m.memberId !== id)
  state.favorites = state.favorites.filter(m => m !== id)
}
export function withdrawLike(state:State,id:string) {
  state.likes = state.likes.filter(l => !(l.from === 'self' && l.to === id))
  state.matches = state.matches.filter(m => m.memberId !== id)
  state.messages = state.messages.filter(m => m.memberId !== id)
}
export function postMessage(state:State,id:string,input:string):boolean {
  const value = input.trim()
  if (!value || value.length > 1000 || state.blocked.includes(id) || !state.matches.some(m => m.memberId === id)) return false
  state.messages.push({id:crypto.randomUUID(),memberId:id,text:value,at:new Date().toISOString(),from:'self',read:false})
  return true
}
export function ageOn(value:string, today = new Date()) {
  const [y,m,d] = value.split('-').map(Number)
  return today.getFullYear()-y-(today.getMonth()+1 < m || (today.getMonth()+1 === m && today.getDate() < d) ? 1 : 0)
}
