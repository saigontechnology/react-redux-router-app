import '../rxjsImports';
import fetchHelper from './FetchHelper.js';

describe('fetchHelper.fetch()', () => {
  let originFetch;
  beforeEach(() => {
    originFetch = global.fetch;
    global.Headers = function Headers() {};
  });
  afterEach(() => {
    global.fetch = originFetch;
  });

  test('when server return json', async () => {
    const responseJson = { data: 'any' };
    global.fetch = () =>
      new Promise(resolve => {
        resolve({
          status: 200,
          json: function() {
            return responseJson;
          }
        });
      });
    const [data, status] = await fetchHelper.fetch();
    expect(data).toEqual(responseJson);
    expect(status).toBe(200);
  });

  test('when server return success with no json', async () => {
    const response = {
      status: 204,
      json: function() {
        JSON.parse('');
      }
    };
    const originalConsoleWarn = console.warn; /* eslint no-console: 0 */
    console.warn = jest.fn();
    global.fetch = () =>
      new Promise(resolve => {
        resolve(response);
      });
    const [data, status] = await fetchHelper.fetch();
    expect(status).toBe(response.status);

    expect(data).toBe(response);
    expect(console.warn.mock.calls.length).toBeGreaterThanOrEqual(0);

    console.warn = originalConsoleWarn;
  });

  test('when server return error with no json', async () => {
    const response = {
      status: 400,
      json: function() {
        JSON.parse('');
      }
    };
    const originalConsoleWarn = console.warn; /* eslint no-console: 0 */
    console.warn = jest.fn();
    global.fetch = () =>
      new Promise(resolve => {
        resolve(response);
      });
    const [data, status] = await fetchHelper.fetch();
    expect(status).toBe(response.status);

    expect(data).toBe(response);
    expect(console.warn.mock.calls.length).toBeGreaterThanOrEqual(1);

    console.warn = originalConsoleWarn;
  });
  test('general error', async () => {
    const originalConsoleWarn = console.warn;
    console.warn = jest.fn();
    const originalFetchWith5XXRetry = fetchHelper._fetchWith5XXRetry;
    fetchHelper._fetchWith5XXRetry = fetch => () => {
      throw '';
    };

    const response = await fetchHelper.fetch('mock url');

    expect(console.warn.mock.calls.length).toBe(1);
    expect(response[1]).toBe(-1);

    fetchHelper._fetchWith5XXRetry = originalFetchWith5XXRetry;
    console.warn = originalConsoleWarn;
  });
});

describe('fetchHelper.jsonToQueryString()', () => {
  test('convert json object to query string', () => {
    const result = fetchHelper.jsonToQueryString({
      x: 1,
      y: null,
      z: undefined,
      t: '',
      u: [1, 2, 3],
      v: 0,
      m: 'somenormalstring',
      n: 'http://localhost:8000',
      o: [1, 'a b']
    });
    expect(result).toBe(
      'x=1&u=1&u=2&u=3&v=0&m=somenormalstring&n=http%3A%2F%2Flocalhost%3A8000&o=1&o=a%20b'
    );
  });
});

describe('fetchHelper._fetchWith5XXRetry()()', () => {
  const MAX_RETRY = fetchHelper.constructor.MAX_RETRY;

  test('NOT retry when HTTP method is NOT GET', async () => {
    const expectErrorResponse = { status: 500 };
    const mockFetch = jest.fn(
      () =>
        new Promise(resolve => {
          resolve(expectErrorResponse);
        })
    );
    const onErrorRetryFetch = fetchHelper._fetchWith5XXRetry(mockFetch);

    const actualResponse = await onErrorRetryFetch('http://my.url', {
      method: 'POST'
    });

    expect(mockFetch.mock.calls.length).toBe(1);
    expect(actualResponse).toEqual(expectErrorResponse);
  });

  test('retry and fail after MAX_RETRY times with 500 error', async () => {
    const expectErrorResponse = { status: 500 };
    const mockFetch = jest.fn(
      () =>
        new Promise(resolve => {
          resolve(expectErrorResponse);
        })
    );

    const onErrorRetryFetch = fetchHelper._fetchWith5XXRetry(mockFetch);

    const actualResponse = await onErrorRetryFetch('http://my.url');

    expect(mockFetch.mock.calls.length).toBe(MAX_RETRY);
    expect(actualResponse).toEqual(expectErrorResponse);
  });

  test('retry and fail after MAX_RETRY times with network error', async () => {
    const networkError = 'network error';
    const mockFetch = jest.fn(
      () =>
        new Promise(resolve => {
          throw networkError;
        })
    );

    const onErrorRetryFetch = fetchHelper._fetchWith5XXRetry(mockFetch);

    try {
      await onErrorRetryFetch('http://my.url');
    } catch (e) {
      expect(e).toBe(networkError);
    }

    expect(mockFetch.mock.calls.length).toBe(MAX_RETRY);
  });

  test('retry 5XX error and success', async () => {
    const errorResponse = { status: 500 };
    const expectedSuccessResponse = { status: 200 };
    const mockFetch = jest.fn(
      () =>
        new Promise(resolve => {
          if (mockFetch.mock.calls.length === 1) {
            resolve(errorResponse);
          } else if (mockFetch.mock.calls.length === 2) {
            resolve(expectedSuccessResponse);
          }
        })
    );

    const onErrorRetryFetch = fetchHelper._fetchWith5XXRetry(mockFetch);

    const actualResponse = await onErrorRetryFetch('http://my.url');

    expect(mockFetch.mock.calls.length).toBe(2);
    expect(actualResponse).toEqual(expectedSuccessResponse);
  });

  test('retry network error and success', async () => {
    const networkError = 'network error';
    const expectedSuccessResponse = { status: 200 };
    const mockFetch = jest.fn(
      () =>
        new Promise(resolve => {
          if (mockFetch.mock.calls.length === 1) {
            throw networkError;
          } else if (mockFetch.mock.calls.length === 2) {
            resolve(expectedSuccessResponse);
          }
        })
    );

    const onErrorRetryFetch = fetchHelper._fetchWith5XXRetry(mockFetch);

    const actualResponse = await onErrorRetryFetch('http://my.url');

    expect(mockFetch.mock.calls.length).toBe(2);
    expect(actualResponse).toEqual(expectedSuccessResponse);
  });

  test('retry and get NONE 5XX error', async () => {
    const errorResponse = { status: 500 };
    const expectedNone5XXResponse = { status: 401 };
    const mockFetch = jest.fn(
      () =>
        new Promise(resolve => {
          if (mockFetch.mock.calls.length === 1) {
            resolve(errorResponse);
          } else if (mockFetch.mock.calls.length === 2) {
            resolve(expectedNone5XXResponse);
          }
        })
    );

    const onErrorRetryFetch = fetchHelper._fetchWith5XXRetry(mockFetch);

    const actualResponse = await onErrorRetryFetch('http://my.url');

    expect(mockFetch.mock.calls.length).toBe(2);
    expect(actualResponse).toEqual(expectedNone5XXResponse);
  });
});

describe('default header feature', () => {
  test('addDefaultHeader(), removeDefaultHeader()', () => {
    const headerKey = 'headerKey';
    const headerValue = 'headerValue';
    fetchHelper.addDefaultHeader(headerKey, headerValue);
    expect(fetchHelper.defaultHeaders[headerKey] === headerValue).toBeTruthy();

    fetchHelper.removeDefaultHeader(headerKey);
    expect(headerKey in fetchHelper.defaultHeaders).toBeFalsy();
  });
});

describe('interceptor feature', () => {
  test('.addBeforeRequestInterceptor()', () => {
    const interceptor = function() {};
    const { beforeRequestInterceptors } = fetchHelper;
    const remove = fetchHelper.addBeforeRequestInterceptor(interceptor);

    expect(
      beforeRequestInterceptors[beforeRequestInterceptors.length - 1] ===
        interceptor
    ).toBeTruthy();

    remove();

    expect(beforeRequestInterceptors.includes(interceptor)).toBeFalsy();
  });

  test('.addAfterResonseInterceptor()', () => {
    const interceptor = function() {};
    const { afterResponseInterceptors } = fetchHelper;
    const remove = fetchHelper.addAfterResonseInterceptor(interceptor);

    expect(
      afterResponseInterceptors[afterResponseInterceptors.length - 1] ===
        interceptor
    ).toBeTruthy();

    remove();

    expect(afterResponseInterceptors.includes(interceptor)).toBeFalsy();
  });
});

test('jsonToForm()', () => {
  expect(fetchHelper.jsonToForm({ x: 1, y: 2 })).toMatchSnapshot();
});

test('getHeader()', () => {
  expect(fetchHelper.getHeader()).toBeDefined();
});

describe('upload file', () => {
  let originalXMLHttpRequest;
  beforeEach(() => {
    originalXMLHttpRequest = global.XMLHttpRequest;
    global.XMLHttpRequest = class MockXMLHttpRequest {
      open() {}
      send() {}
    };
  });
  afterEach(() => {});
});
test('uploadFile() with json response', async () => {
  const responseJson = { data: [] };
  const responseText = JSON.stringify(responseJson);
  const status = 200;
  let originalXMLHttpRequest = global.XMLHttpRequest;
  global.XMLHttpRequest = class MockXMLHttpRequest {
    status = status;
    upload = {};
    setRequestHeader() {}
    open() {}
    send() {
      const e = {
        target: {
          responseText
        }
      };
      this.onload(e);
    }
  };
  const url = 'mock url';
  const response = await fetchHelper.uploadFile(
    url,
    {
      method: 'POST',
      headers: { headerKey: 'headerValue' }
    },
    e => {}
  );

  expect(response).toEqual([responseJson, status]);

  global.XMLHttpRequest = originalXMLHttpRequest;
});

test('uploadFile() without json response', async () => {
  const responseText = 'not a json response';
  const status = 200;
  let originalXMLHttpRequest = global.XMLHttpRequest;
  global.XMLHttpRequest = class MockXMLHttpRequest {
    status = status;
    setRequestHeader() {}
    open() {}
    send() {
      const e = {
        target: {
          responseText
        }
      };
      this.onload(e);
    }
  };
  const url = 'mock url';
  const response = await fetchHelper.uploadFile(
    url,
    {
      method: 'POST',
      headers: { headerKey: 'headerValue' }
    },
    e => {}
  );

  expect(response).toEqual([responseText, status]);

  global.XMLHttpRequest = originalXMLHttpRequest;
});
