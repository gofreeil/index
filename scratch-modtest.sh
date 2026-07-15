#!/usr/bin/env bash
cd "D:/Users/User/Documents/GitHub/index"
TOKEN=$(grep '^STRAPI_TOKEN=' .env | cut -d= -f2- | tr -d '\r"' | xargs)
H="Authorization: Bearer $TOKEN"; JH="Content-Type: application/json"
echo "[1] ממתין לפריסת תיקון-המודרציה (PUT status → 200 במקום 404)..."
i=0
while [ $i -lt 60 ]; do
  bid=$(curl -s -X POST -H "$H" -H "$JH" -d '{"data":{"name":"__modprobe__","discount":"x","accepted_terms":true}}' "https://api.gofreeil.com/api/idx-businesses" | node -e 'let d="";process.stdin.on("data",c=>c&&(d+=c)).on("end",()=>{try{console.log(JSON.parse(d).data.documentId)}catch{console.log("")}})')
  code=$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H "$H" -H "$JH" -d '{"data":{"status":"approved"}}' "https://api.gofreeil.com/api/idx-businesses/$bid")
  curl -s -X DELETE -H "$H" "https://api.gofreeil.com/api/idx-businesses/$bid" -o /dev/null
  if [ "$code" = "200" ]; then echo "  ✓ מודרציית עסקים עובדת (PUT→200)"; break; fi
  i=$((i+1)); sleep 20
done
[ $i -ge 60 ] && { echo "  ✗ timeout"; exit 2; }
echo "[2] בדיקת מחזור מלא: עסק pending→approved, ביקורת pending→approved (עם recompute)"
bid=$(curl -s -X POST -H "$H" -H "$JH" -d '{"data":{"name":"__full_test__","discount":"10%","accepted_terms":true}}' "https://api.gofreeil.com/api/idx-businesses" | node -e 'let d="";process.stdin.on("data",c=>c&&(d+=c)).on("end",()=>console.log(JSON.parse(d).data.documentId))')
curl -s -o /dev/null -w "  אישור עסק: PUT %{http_code}\n" -X PUT -H "$H" -H "$JH" -d '{"data":{"status":"approved"}}' "https://api.gofreeil.com/api/idx-businesses/$bid"
rid=$(curl -s -X POST -H "$H" -H "$JH" -d "{\"data\":{\"business\":\"$bid\",\"rating\":4,\"body\":\"בדיקה\",\"author_name\":\"טסט\"}}" "https://api.gofreeil.com/api/idx-reviews" | node -e 'let d="";process.stdin.on("data",c=>c&&(d+=c)).on("end",()=>console.log(JSON.parse(d).data.documentId))')
curl -s -o /dev/null -w "  אישור ביקורת: PUT %{http_code}\n" -X PUT -H "$H" -H "$JH" -d '{"data":{"status":"approved"}}' "https://api.gofreeil.com/api/idx-reviews/$rid"
sleep 1
curl -s -H "$H" "https://api.gofreeil.com/api/idx-businesses/$bid" | node -e 'let d="";process.stdin.on("data",c=>c&&(d+=c)).on("end",()=>{const b=JSON.parse(d).data;console.log("  דירוג העסק אחרי אישור הביקורת: rating_avg="+b.rating_avg+" rating_count="+b.rating_count+" (מצופה 4/1)")})'
echo "[3] ניקוי"
curl -s -X DELETE -H "$H" "https://api.gofreeil.com/api/idx-reviews/$rid" -o /dev/null -w "  del review %{http_code}\n"
curl -s -X DELETE -H "$H" "https://api.gofreeil.com/api/idx-businesses/$bid" -o /dev/null -w "  del biz %{http_code}\n"
echo "DONE"
