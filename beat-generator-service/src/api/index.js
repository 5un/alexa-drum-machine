import { version } from '../../package.json';
import { Router } from 'express';
import facets from './facets';
import fs from 'fs';
import uuidv1 from 'uuid/v1';
import FuzzySet from 'fuzzyset.js'
import { generateGroove, overrideMMATempo, readMMATempo } from '../lib/mma';
import config from '../config.json';
import secrets from '../../secrets/aws.json';
import songList from '../lib/songs';
import artists from '../lib/artists';
var exec = require('child_process').exec;
import AWS from 'aws-sdk';
import _ from 'lodash';

const songDatabase = FuzzySet(songList);
const artistDatabase = FuzzySet(_.map(artists, (a) => (a.name) ));
const songCache = {};

var accessKeyId =  process.env.AWS_ACCESS_KEY || secrets.AWS_ACCESS_KEY;
var secretAccessKey = process.env.AWS_SECRET_KEY || secrets.AWS_SECRET_KEY;

AWS.config.update({
  accessKeyId: accessKeyId,
  secretAccessKey: secretAccessKey
});

var s3 = new AWS.S3();

const generateTrack = (mma, filename, cb) => {
  fs.writeFile(`./temp/${filename}.mma`, mma, function(err) {
    if(err) {
      cb({ message: 'Cannot generate MMA file' }, null);
    } else {
      const script = `mma ./temp/${filename}.mma &&
        fluidsynth ./soundfonts/FluidR3_GM.sf2 ./temp/${filename}.mid -F ./temp/${filename}.wav &&
        lame --scale 5 ./temp/${filename}.wav ./temp/${filename}.mp3`
      let child;
      child = exec(script, function (error, stdout, stderr) {
        if (error !== null) {
          cb({ message: `Cannot execute command ${error}` }, null);
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
                cb({ message: 'Cannot upload file', s3Error: perr }, null);
              } else {
                cb(null, { url: `https://s3.amazonaws.com/${config.s3Bucket}/${config.s3Path}/${filename}.mp3` });
              }
            });
        });
                  
        }
      });
    }
  }); 
};

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
    const tempo = req.query.tempo || 100;
    const groove = req.query.groove || 'pop';
    const mma = generateGroove({ tempo: tempo, groove: groove });
    generateTrack(mma, filename, (err, gres) => {
      if(err) {
        res.status(400).send({ error: err });
      } else {
        res.json(gres);
      }
    });
  });

  api.get('/artists/search', (req, res) => {
    res.json({});
  });

  api.get('/songs/search', (req, res) => {
    const query = req.query.q || '';
    const tempo  = req.query.tempo;
    // Find first match
    let matches = _.filter(
                      _.map(
                        songDatabase.get(query), (item) => ({ confidence: item[0], name: item[1] })
                      ),
                      (item) => (item.confidence > 0.7)
                    );

    if (matches.length <= 0) {
      matches = _.map(
        songDatabase.get('with-a-little-help-from-my-friends'), (item) => ({ confidence: item[0], name: item[1] })
      );
    }

    const song = matches[0];
    const cacheKey = `${song.name}${tempo ? '@tempo' + tempo : ''}`;
    if (songCache[cacheKey]) {
      const cachedSong = songCache[cacheKey];
      res.json(cachedSong);
    } else {
      const filename = uuidv1();
      fs.readFile(`./songs/${song.name}.mma`, 'utf8', function (err, mma) {
        if (err) {
          res.status(400).send({ error: { message: 'Cannot read song file' } });
        } else {
          const originalTempo = readMMATempo(mma);
          song.originalTempo = originalTempo;
          if (tempo) {
            mma = overrideMMATempo(mma, tempo);
          }
          generateTrack(mma, filename, (err, gres) => {
            if(err) {
              res.status(400).send({ error: err });
            } else {
              songCache[cacheKey] = Object.assign(song, { url: gres.url, originalURL: config.defaultOriginalTrackURL });
              res.json(Object.assign(gres, song));
            }
          });
        }
        
      });
    }
  });

	return api;
}
