rm index.zip 
zip -r index.zip js
#aws lambda update-function-code --function-name alexaDrumMachineLambdaFunc --zip-file fileb://index.zip --profile=<your profile name>

