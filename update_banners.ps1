$url = "https://vqmm-8a365-default-rtdb.asia-southeast1.firebasedatabase.app/config/banners.json"
$body = Get-Content -Raw -Encoding UTF8 ./banners.json

[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
Invoke-RestMethod -Uri $url -Method Put -Body $body -ContentType "application/json"
Write-Host "Banners updated successfully."
