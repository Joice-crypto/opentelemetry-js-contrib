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

import { SpanKind, SpanStatus, SpanStatusCode } from '@opentelemetry/api';
import { hrTimeToNanoseconds } from '@opentelemetry/core';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { strictEqual, deepStrictEqual, ok } from 'assert';
import type { LookupAddress } from 'dns';
import { AttributeNames } from '../../src/enums/AttributeNames';
import * as utils from '../../src/utils';

export const assertSpan = (
  span: ReadableSpan,
  validations: {
    addresses: LookupAddress[];
    hostname: string;
    forceStatus?: SpanStatus;
  }
) => {
  if (span.spanContext().traceId) {
    strictEqual(span.spanContext().traceId.length, 32);
  }
  if (span.spanContext().spanId) {
    strictEqual(span.spanContext().spanId.length, 16);
  }

  strictEqual(span.kind, SpanKind.CLIENT);

  strictEqual(
    span.attributes[AttributeNames.DNS_ERROR_MESSAGE],
    span.status.message
  );

  validations.addresses.forEach((_, i) => {
    strictEqual(
      span.attributes[utils.getFamilyAttribute(_.family, i)],
      _.address
    );
  });

  ok(span.endTime);
  strictEqual(span.links.length, 0);
  strictEqual(span.events.length, 0);

  deepStrictEqual(
    span.status,
    validations.forceStatus || { code: SpanStatusCode.UNSET }
  );

  ok(hrTimeToNanoseconds(span.duration), 'must have positive duration');
};
