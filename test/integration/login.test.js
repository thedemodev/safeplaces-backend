process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
process.env.DATABASE_URL || 'postgres://localhost/safeplaces_test';

const { v4: uuidv4 } = require('uuid');
const atob = require('atob');
const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../../app');

const mockData = require('../lib/mockData');

chai.use(chaiHttp);

function parseJwt(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(''),
  );

  return JSON.parse(jsonPayload);
}

let newUserParams;
let currentOrg;

before(async () => {
  let orgParams = {
    id: uuidv4(),
    name: 'My Example Organization',
    info_website_url: 'http://sample.com',
  };
  currentOrg = await mockData.mockOrganization(orgParams);

  newUserParams = {
    username: 'myAwesomeUser',
    password: 'myAwesomePassword',
    email: 'myAwesomeUser@yomanbob.com',
    organization_id: currentOrg.id,
  };
  await mockData.mockUser(newUserParams);
});

describe('POST /login', function () {
  it('should login on user creds and return map api key', function (done) {
    chai
      .request(server.app)
      .post('/login')
      .send({
        username: newUserParams.username,
        password: newUserParams.password,
      })
      .end(function (err, res) {
        res.should.have.status(200);
        res.should.be.json; // jshint ignore:line
        res.body.should.have.property('token');
        let parsedJwt = parseJwt(res.body.token);
        parsedJwt.should.have.property('sub');
        parsedJwt.sub.should.equal(newUserParams.username);
        parsedJwt.should.have.property('iat');
        chai.assert.equal(new Date(parsedJwt.iat * 1000) instanceof Date, true);
        parsedJwt.should.have.property('exp');
        chai.assert.equal(new Date(parsedJwt.exp * 1000) instanceof Date, true);
        res.body.should.have.property('maps_api_key');
        res.body.maps_api_key.should.equal(process.env.SEED_MAPS_API_KEY);
        done();
      });
  });

  it('should fail when wrong password is given saying creds are invalid', function (done) {
    chai
      .request(server.app)
      .post('/login')
      .send({
        username: newUserParams.username,
        password: 'wrongpassword',
      })
      .end(function (err, res) {
        res.should.have.status(401);
        res.should.be.json; // jshint ignore:line
        res.body.should.have.property('message');
        res.body.message.should.equal('Invalid credentials.');
        done();
      });
  });

  it('should fail with invalid username saying creds are invalid', function (done) {
    chai
      .request(server.app)
      .post('/login')
      .send({
        username: 'wronguser',
        password: newUserParams.password,
      })
      .end(function (err, res) {
        res.should.have.status(401);
        res.should.be.json; // jshint ignore:line
        res.body.should.have.property('message');
        res.body.message.should.equal('Invalid credentials.');
        done();
      });
  });
});
