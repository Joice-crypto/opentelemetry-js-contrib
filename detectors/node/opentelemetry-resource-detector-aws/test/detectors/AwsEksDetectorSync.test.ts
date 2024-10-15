/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { enableNetConnect, cleanAll, disableNetConnect } from 'nock';
import { ok } from 'assert';
import { restore, assert, stub } from 'sinon';
import { Resource } from '@opentelemetry/resources';
import { awsEksDetectorSync, AwsEksDetectorSync } from '../../src';
import {
  assertK8sResource,
  assertContainerResource,
  assertEmptyResource,
} from '@opentelemetry/contrib-test-utils';
import nock = require('nock');

const K8S_SVC_URL = awsEksDetectorSync.K8S_SVC_URL;
const AUTH_CONFIGMAP_PATH = awsEksDetectorSync.AUTH_CONFIGMAP_PATH;
const CW_CONFIGMAP_PATH = awsEksDetectorSync.CW_CONFIGMAP_PATH;

describe('awsEksDetectorSync', () => {
  const errorMsg = {
    fileNotFoundError: new Error('cannot find cgroup file'),
  };

  const correctCgroupData =
    'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklm';
  const mockedClusterResponse = '{"data":{"cluster.name":"my-cluster"}}';
  const mockedAwsAuth = 'my-auth';
  const k8s_token = 'Bearer 31ada4fd-adec-460c-809a-9e56ceb75269';
  let readStub, fileStub, getCredStub;

  beforeEach(() => {
    disableNetConnect();
    cleanAll();
  });

  afterEach(() => {
    restore();
    enableNetConnect();
  });

  describe('on successful request', () => {
    it('should return an aws_eks_instance_resource', async () => {
      fileStub = stub(AwsEksDetectorSync, 'fileAccessAsync' as any).resolves();
      readStub = stub(AwsEksDetectorSync, 'readFileAsync' as any).resolves(
        correctCgroupData
      );
      getCredStub = stub(
        awsEksDetectorSync,
        '_getK8sCredHeader' as any
      ).resolves(k8s_token);
      const scope = nock('https://' + K8S_SVC_URL)
        .persist()
        .get(AUTH_CONFIGMAP_PATH)
        .matchHeader('Authorization', k8s_token)
        .reply(200, () => mockedAwsAuth)
        .get(CW_CONFIGMAP_PATH)
        .matchHeader('Authorization', k8s_token)
        .reply(200, () => mockedClusterResponse);

      const resource = awsEksDetectorSync.detect();
      await resource.waitForAsyncAttributes?.();

      scope.done();

      assert.calledOnce(fileStub);
      assert.calledTwice(readStub);
      assert.calledTwice(getCredStub);

      ok(resource);
      assertK8sResource(resource, {
        clusterName: 'my-cluster',
      });
      assertContainerResource(resource, {
        id: 'bcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklm',
      });
    });

    it('should return a resource with clusterName attribute without cgroup file', async () => {
      fileStub = stub(AwsEksDetectorSync, 'fileAccessAsync' as any).resolves();
      readStub = stub(AwsEksDetectorSync, 'readFileAsync' as any)
        .onSecondCall()
        .rejects(errorMsg.fileNotFoundError);
      getCredStub = stub(
        awsEksDetectorSync,
        '_getK8sCredHeader' as any
      ).resolves(k8s_token);
      const scope = nock('https://' + K8S_SVC_URL)
        .persist()
        .get(AUTH_CONFIGMAP_PATH)
        .matchHeader('Authorization', k8s_token)
        .reply(200, () => mockedAwsAuth)
        .get(CW_CONFIGMAP_PATH)
        .matchHeader('Authorization', k8s_token)
        .reply(200, () => mockedClusterResponse);

      const resource = awsEksDetectorSync.detect();
      await resource.waitForAsyncAttributes?.();

      scope.done();

      ok(resource);
      assertK8sResource(resource, {
        clusterName: 'my-cluster',
      });
    });

    it('should return a resource with container ID attribute without a clusterName', async () => {
      fileStub = stub(AwsEksDetectorSync, 'fileAccessAsync' as any).resolves();
      readStub = stub(AwsEksDetectorSync, 'readFileAsync' as any).resolves(
        correctCgroupData
      );
      getCredStub = stub(
        awsEksDetectorSync,
        '_getK8sCredHeader' as any
      ).resolves(k8s_token);
      const scope = nock('https://' + K8S_SVC_URL)
        .persist()
        .get(AUTH_CONFIGMAP_PATH)
        .matchHeader('Authorization', k8s_token)
        .reply(200, () => mockedAwsAuth)
        .get(CW_CONFIGMAP_PATH)
        .matchHeader('Authorization', k8s_token)
        .reply(200, () => '');

      const resource = awsEksDetectorSync.detect();
      await resource.waitForAsyncAttributes?.();

      scope.done();

      ok(resource);
      assertContainerResource(resource, {
        id: 'bcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklm',
      });
    });

    it('should return a resource with clusterName attribute when cgroup file does not contain valid Container ID', async () => {
      fileStub = stub(AwsEksDetectorSync, 'fileAccessAsync' as any).resolves();
      readStub = stub(AwsEksDetectorSync, 'readFileAsync' as any)
        .onSecondCall()
        .resolves('');
      getCredStub = stub(
        awsEksDetectorSync,
        '_getK8sCredHeader' as any
      ).resolves(k8s_token);
      const scope = nock('https://' + K8S_SVC_URL)
        .persist()
        .get(AUTH_CONFIGMAP_PATH)
        .matchHeader('Authorization', k8s_token)
        .reply(200, () => mockedAwsAuth)
        .get(CW_CONFIGMAP_PATH)
        .matchHeader('Authorization', k8s_token)
        .reply(200, () => mockedClusterResponse);

      const resource = awsEksDetectorSync.detect();
      await resource.waitForAsyncAttributes?.();

      scope.done();

      ok(resource);
      ok(resource);
      assertK8sResource(resource, {
        clusterName: 'my-cluster',
      });
    });

    it('should return an empty resource when not running on Eks', async () => {
      fileStub = stub(AwsEksDetectorSync, 'fileAccessAsync' as any).resolves(
        ''
      );
      readStub = stub(AwsEksDetectorSync, 'readFileAsync' as any).resolves(
        correctCgroupData
      );
      getCredStub = stub(
        awsEksDetectorSync,
        '_getK8sCredHeader' as any
      ).resolves(k8s_token);
      const scope = nock('https://' + K8S_SVC_URL)
        .persist()
        .get(AUTH_CONFIGMAP_PATH)
        .matchHeader('Authorization', k8s_token)
        .reply(200, () => '');

      const resource = awsEksDetectorSync.detect();
      await resource.waitForAsyncAttributes?.();

      scope.done();

      ok(resource);
      assertEmptyResource(resource);
    });

    it('should return an empty resource when k8s token file does not exist', async () => {
      const errorMsg = {
        fileNotFoundError: new Error('cannot file k8s token file'),
      };
      fileStub = stub(AwsEksDetectorSync, 'fileAccessAsync' as any).rejects(
        errorMsg.fileNotFoundError
      );

      const resource: Resource = await awsEksDetectorSync.detect();

      ok(resource);
      assertEmptyResource(resource);
    });

    it('should return an empty resource when containerId and clusterName are invalid', async () => {
      fileStub = stub(AwsEksDetectorSync, 'fileAccessAsync' as any).resolves(
        ''
      );
      readStub = stub(AwsEksDetectorSync, 'readFileAsync' as any)
        .onSecondCall()
        .rejects(errorMsg.fileNotFoundError);

      getCredStub = stub(
        awsEksDetectorSync,
        '_getK8sCredHeader' as any
      ).resolves(k8s_token);
      const scope = nock('https://' + K8S_SVC_URL)
        .persist()
        .get(AUTH_CONFIGMAP_PATH)
        .matchHeader('Authorization', k8s_token)
        .reply(200, () => mockedAwsAuth)
        .get(CW_CONFIGMAP_PATH)
        .matchHeader('Authorization', k8s_token)
        .reply(200, () => '');

      const resource = awsEksDetectorSync.detect();
      await resource.waitForAsyncAttributes?.();

      scope.isDone();

      ok(resource);
      assertEmptyResource(resource);
    });
  });

  describe('on unsuccessful request', () => {
    it('should return an empty resource when timed out', async () => {
      fileStub = stub(AwsEksDetectorSync, 'fileAccessAsync' as any).resolves();
      readStub = stub(AwsEksDetectorSync, 'readFileAsync' as any).resolves(
        correctCgroupData
      );
      getCredStub = stub(
        awsEksDetectorSync,
        '_getK8sCredHeader' as any
      ).resolves(k8s_token);
      const scope = nock('https://' + K8S_SVC_URL)
        .persist()
        .get(AUTH_CONFIGMAP_PATH)
        .matchHeader('Authorization', k8s_token)
        .delayConnection(2500)
        .reply(200, () => mockedAwsAuth);

      const resource = awsEksDetectorSync.detect();
      await resource.waitForAsyncAttributes?.();

      scope.done();

      ok(resource);
      assertEmptyResource(resource);
    }).timeout(awsEksDetectorSync.TIMEOUT_MS + 100);

    it('should return an empty resource when receiving error response code', async () => {
      fileStub = stub(AwsEksDetectorSync, 'fileAccessAsync' as any).resolves();
      readStub = stub(AwsEksDetectorSync, 'readFileAsync' as any).resolves(
        correctCgroupData
      );
      getCredStub = stub(
        awsEksDetectorSync,
        '_getK8sCredHeader' as any
      ).resolves(k8s_token);
      const scope = nock('https://' + K8S_SVC_URL)
        .persist()
        .get(AUTH_CONFIGMAP_PATH)
        .matchHeader('Authorization', k8s_token)
        .reply(404, () => new Error());

      const resource = awsEksDetectorSync.detect();
      await resource.waitForAsyncAttributes?.();

      scope.done();

      ok(resource);
      assertEmptyResource(resource);
    });
  });
});
