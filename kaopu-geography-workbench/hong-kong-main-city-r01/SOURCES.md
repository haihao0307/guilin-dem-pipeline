# 啟德 × 88主幹線：來源與精度

本候選只把可追溯的機場地理形狀、原有車站與88鐵路放進同一個DEM場景校準。不是歷史CAD復原、工程設計或航空導航資料。

## 1970平面底圖

- 香港地政總署 Historical Map — Kowloon Peninsula (1970)，原圖比例1:15,840，紙圖掃描後由官方配準至Hong Kong 1980 Grid。不是CAD。
- 目錄：https://data.gov.hk/en-data/dataset/hk-landsd-openmap-historical-maps/resource/dea70f69-bd04-46ae-8fee-de3b1fc39fd2
- 官方下載：https://www.landsd.gov.hk/landsd_psi_data/SMO/data/Kowloon-Peninsula-(Batch-2).zip
- 本輪逐點讀取GeoTIFF像素與內嵌仿射地理變換，生成獨立的米制向量。像素間距約1.715m只是取樣間距，不代表1.715m測量精度；原圖概化、線寬、掃描配準及人工取點誤差另計。
- 跑道欄位記錄圖上可辨的鋪面輪廓端點，不是已核定的航空入口座標。13/31僅標方向；未獲證據的入口條紋及數字落點不繪製。機坪及海岸是有來源的概化描圖，不作測繪認證。
- DATA.GOV.HK條款：https://data.gov.hk/en/terms-and-conditions
- 地政署開放資料說明：https://www.landsd.gov.hk/en/spatial-data/open-data.html

原始GeoTIFF、用戶提供照片、遊戲復刻圖、官方報告內第三方照片/圖頁不進入公開運行資產。用戶照片用於私下視覺交叉檢查；數字遊戲圖不作測量依據。

## 年代與長度

香港民航處及機場管理局的歷史頁記錄1958年新西北—東南跑道2,529m，後期延長至3,390m；1970底圖不能直接套用延長後長度。

- 民航處：https://www.cad.gov.hk/english/kaitak.html?level=1
- 機場管理局：https://www.hongkongairport.com/en/about-us/
- EPD官方托管的文化遺產研究另記1971年2,541m、1975年3,390m：https://www.epd.gov.hk/eia/files/applications/en/pp_160/eia_1668/progress/action_2865/Text/S8%20Cultural%20Heritage%20v2.htm
- 同報告Drawing8.2把填海延伸區標為1974，但圖框明示N.T.S.，只用於理解分期，不作可量尺度CAD：https://www.epd.gov.hk/eia/files/applications/en/pp_160/eia_1668/progress/action_2865/Drawings/DWG%208.2.htm

圖上鋪面長度與公布的可用跑道長度分開記錄。未識別清楚的停止區、衝出區或入口位移，不以猜測平均分配。

## 九龍鐘樓與站體

AMO官方明確記載塔身44m，上有7m避雷針，兩者分開。本候選只校準鐘樓上部總高與針長；上部分區形狀仍是原創模型假設，未宣稱精確建築測繪復原。站廳、站棚的平面尺寸與歷史朝向仍未取得可量的歷史測繪認證，未因塔高而整站放大。

- AMO：https://www.amo.gov.hk/en/historic-buildings/monuments/kowloon/monuments_43/index.html
- 可重跑測量：qa/audit-station.py
- 結果：evidence/kowloon-scale-audit.json
- 原/校準切換：入口附加station=original參數，保留全部原始公開資產。

## DEM與坐標

場景原點為EPSG:2326 E834000/N827000；X=E−834000，Z=827000−N；1場景單位=1米。原R03為現代DSM加已有故事地形修改；不能把現代填海和樓群當1970海岸。新機場幾何及局部海陸遮罩是獨立顯示層，原底圖不覆寫。機場顯示高度不是已建立的歷史HKPD/EGM2008測量高程。

原R03地形來源及許可繼續適用：produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved。CEDD / Lands Department HKSAR Government官方開放資料。現代走廊參照©OpenStreetMap contributors, ODbL。

## 88鐵路連接

固定207d811候選的出站初段誤用鐘樓錨點作站體原點，B股道橫向錯24m。新衍生腳本只修起點與短連接段，保留原候選與其餘主線。這是代碼坐標一致性修正，不等於考證完成的歷史線形。詳見evidence/track-alignment.json。

車廂、城寨真實網格、完整隧道與主線全程驗收仍未完成。軟件GPU截圖成功不等於實機流暢認證。
