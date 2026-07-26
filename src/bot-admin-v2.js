import { BotAdminService } from './bot-admin.js';
export class BotAdminServiceV2 extends BotAdminService{
 clients(){const map=new Map((this.store.listBotUsers?.()||[]).map(user=>[user.key,{...user,country:'',budget:'',group:'',dates:'',active:false,...this.data.clientMeta(user.key)}]));for(const sub of this.store.listSubscriptions?.()||[]){const key=`${sub.platform}:${sub.userId}`,params=sub.params||{},old=map.get(key)||{};map.set(key,{...old,key,platform:sub.platform,userId:String(sub.userId),country:String(params.destination||''),budget:String(params.budget||''),group:String(params.group||''),dates:String(params.dates||''),active:true,createdAt:sub.createdAt,...this.data.clientMeta(key)})}return[...map.values()]}
}
