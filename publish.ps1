$type = $null

$type = Read-Host -Prompt "Is this a patch, minor or major release? (p/m/M)" 

if ($type -ne "p" -and $type -ne "m" -and $type -ne "M") {
    Write-Host "Invalid input. Please enter p, m or M"
    exit
}

cd ./server
yarn build 

cd ../client
yarn build 

cd ../
node bumpVersions.js $type

cd ./server
npm publish

cd ../client
npm publish

cd ../