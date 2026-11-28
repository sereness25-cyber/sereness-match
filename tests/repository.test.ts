import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { members, searchMembers } from '../app/demo-data.ts'
import { ageOn, block, fresh, LocalRepository, postMessage, sendLike } from '../app/repository.ts'

describe('試用の会員操作', () => {
  it('属性の組み合わせと並び替えを反映する', () => {
    assert.deepEqual(searchMembers(members,{region:'秋田市',gender:'男性',sort:'age'}).map(p=>p.id),['naoki','yuta'])
    assert.deepEqual(searchMembers(members,{minHeight:'173',verified:'yes',hobbies:'音楽'}).map(p=>p.id),['yuta'])
  })
  it('相互いいねのみで一度だけ成立し、ブロック後の送信を拒む', () => {
    const state=fresh()
    assert.equal(sendLike(state,'misaki',10),'sent')
    assert.equal(postMessage(state,'misaki','未成立'),false)
    assert.equal(sendLike(state,'akari',10),'matched')
    assert.equal(sendLike(state,'akari',10),'duplicate')
    assert.equal(state.matches.length,1)
    assert.equal(postMessage(state,'akari','  こんにちは  '),true)
    assert.equal(state.messages.at(-1)?.text,'こんにちは')
    block(state,'akari')
    assert.equal(state.matches.length,0)
    assert.equal(sendLike(state,'akari',10),'blocked')
    assert.equal(postMessage(state,'akari','送信不可'),false)
  })
  it('いいね上限、空のメッセージ、誕生日前の年齢を扱う', () => {
    const state=fresh()
    assert.equal(sendLike(state,'akari',1),'matched')
    assert.equal(sendLike(state,'yuta',1),'limit')
    assert.equal(postMessage(state,'akari',' '),false)
    assert.equal(ageOn('2008-11-28',new Date(2026,10,27)),17)
  })
  it('同じブラウザ相当の保存先から試用データを読み直す', () => {
    const data = new Map<string,string>()
    const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)}}
    const state=fresh()
    sendLike(state,'akari',10)
    new LocalRepository(storage).save(state)
    assert.deepEqual(new LocalRepository(storage).load(),state)
  })
})
