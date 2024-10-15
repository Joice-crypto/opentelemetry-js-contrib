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

import { strictEqual } from 'assert';
import {
  assertCloudResource,
  assertEmptyResource,
} from '@opentelemetry/contrib-test-utils';

import { awsLambdaDetectorSync } from '../../src';

describe('awsLambdaDetectorSync', () => {
  let oldEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    oldEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = oldEnv;
  });

  describe('on lambda', () => {
    it('fills resource', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'name';
      process.env.AWS_LAMBDA_FUNCTION_VERSION = 'v1';
      process.env.AWS_REGION = 'us-east-1';

      const resource = awsLambdaDetectorSync.detect();

      assertCloudResource(resource, {
        provider: 'aws',
        region: 'us-east-1',
      });

      strictEqual(resource.attributes['faas.name'], 'name');
      strictEqual(resource.attributes['faas.version'], 'v1');
    });
  });

  describe('not on lambda', () => {
    it('returns empty resource', async () => {
      process.env.AWS_LAMBDA_FUNCTION_VERSION = 'v1';
      process.env.AWS_REGION = 'us-east-1';

      const resource = awsLambdaDetectorSync.detect();

      assertEmptyResource(resource);
    });
  });
});
