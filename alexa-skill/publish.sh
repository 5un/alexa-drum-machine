rm index.zip 
cd js
zip ../index.zip * -r
cd ..
aws lambda update-function-code --function-name alexaDrumMachineFunc --zip-file fileb://index.zip --profile=soravis
