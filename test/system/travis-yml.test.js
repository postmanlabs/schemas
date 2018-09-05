/* global describe, it, expect */
describe('travis.yml', function () {
    var fs = require('fs'),
        yaml = require('js-yaml'),
        travisYAML,
        travisYAMLError;

    try {
        travisYAML = yaml.safeLoad(fs.readFileSync('.travis.yml').toString());
    }
    catch (e) {
        travisYAMLError = e;
    }

    it('should exist', function (done) {
        fs.stat('.travis.yml', done);
    });

    it('should be a valid yml', function () {
        expect(travisYAMLError && travisYAMLError.message || travisYAMLError).to.not.be.ok;
    });

    describe('strucure', function () {
        it('should have language to be set to node', function () {
            expect(travisYAML.language).to.equal('node_js');
            expect(travisYAML.node_js).to.equal('stable');
        });

        it('should cache node_modules', function () {
            expect(travisYAML.cache).to.eql({ directories: ['node_modules'] });
        });

        it('should have the jobs defined', function () {
            expect(travisYAML.jobs).to.be.an('object');
            expect(travisYAML.jobs).to.have.property('include');
            expect(travisYAML.jobs.include).to.have.lengthOf(2, 'should have 2 stages');
        });
    });

    describe('jobs', function () {
        describe('stage: test', function () {
            it('should have script defined correctly', function () {
                var testStage = travisYAML.jobs.include[0];

                expect(testStage).to.have.property('stage', 'test');
                expect(testStage).to.have.property('script', 'npm test');
            });
        });

        describe('stage: deploy', function () {
            var deployStage = travisYAML.jobs.include[1];

            it('should have check to deploy only on develop branch', function () {
                expect(deployStage).to.have.property('stage', 'deploy');
                expect(deployStage).to.have.property('if', 'branch = develop AND type = push');
            });

            it('should have check for required environment variables', function () {
                expect(deployStage).to.have.property('before_script',
                    '[[ "$S3_BUCKET" ]] && [[ "$AWS_ACCESS_KEY_ID" ]] && [[ "$AWS_SECRET_ACCESS_KEY" ]]');
            });

            it('should have script defined correctly', function () {
                expect(deployStage).to.have.property('script');
                expect(deployStage.script).to.have.lengthOf(3, 'should have 3 scripts');
                expect(deployStage.script[0]).to.equal('npm run build-docs');
                expect(deployStage.script[1]).to.equal('pip install --user awscli');
                expect(deployStage.script[2])
                    .to.equal('aws s3 sync ./webout s3://$S3_BUCKET/ --delete --follow-symlinks');
            });
        });
    });
});
