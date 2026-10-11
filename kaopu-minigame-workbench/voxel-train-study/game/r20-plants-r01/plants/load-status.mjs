export function nativePlantFailureStatus(error){
 const message=String(error?.message??error??'');
 const unverified=message.includes('Unqualified native output hash pair');
 return Object.freeze({unverified,retainScene:true,message:unverified?'此瀏覽器的植物生成結果尚未驗證，已保留原場景，列車仍可操作':'原生植物讀取失敗，已保留原場景，列車仍可操作'});
}
