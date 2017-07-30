import { version } from '../../package.json';
import { Router } from 'express';
import facets from './facets';
import fs from 'fs';
import uuidv1 from 'uuid/v1';
import { generateGroove } from '../lib/mma';
import config from '../config.json';
import secrets from '../../secrets/aws.json';

var sys = require('sys')
var exec = require('child_process').exec;
import AWS from 'aws-sdk';
var accessKeyId =  process.env.AWS_ACCESS_KEY || secrets.AWS_ACCESS_KEY;
var secretAccessKey = process.env.AWS_SECRET_KEY || secrets.AWS_SECRET_KEY;

AWS.config.update({
  accessKeyId: accessKeyId,
  secretAccessKey: secretAccessKey
});

var s3 = new AWS.S3();

export default ({ config, db }) => {
	let api = Router();

	// mount the facets resource
	api.use('/facets', facets({ config, db }));

	// perhaps expose some API metadata at the root
	api.get('/', (req, res) => {
		res.json({ version });
	});

  api.get('/generate', (req, res) => {
    const filename = uuidv1();
    const mma = generateGroove({ tempo: 110, groove: '8beat'});
    fs.writeFile(`./temp/${filename}.mma`, mma, function(err) {
      if(err) {
        res.json({ error: { message: 'Cannot generate MMA file' } });
      } else {
        let child;
        const script = `
          mma ./temp/${filename}.mma && 
          fluidsynth ./soundfonts/FluidR3_GM.sf2 ./temp/${filename}.mid -F ./temp/${filename}.wav &&
          lame --scale 5 ./temp/${filename}.wav ./temp/${filename}.mp3
        `
        child = exec(script, function (error, stdout, stderr) {
          if (error !== null) {
            res.json({ error: { message: `Cannot execute command ${error}` } });
          } else {
            fs.readFile(`./temp/${filename}.mp3`, function(err, file_buffer){
              var params = {
                Bucket: config.s3Bucket,
                Key: `${config.s3Path}/${filename}.mp3`,
                Body: file_buffer,
                ACL:'public-read'
              };

              s3.putObject(params, function (perr, pres) {
                  if (perr) {
                    res.json({ error: { message: 'Cannot upload file', s3Error: perr } });
                    // console.log("Error uploading data: ", perr);
                  } else {
                    res.json({ url: `https://s3.amazonaws.com/${config.s3Bucket}/${config.s3Path}/${filename}.mp3` });
                    // console.log("Successfully uploaded data to myBucket/myKey");
                  }
              });
          });
                    
          }
        });
      }
    }); 
  });

	return api;
}
