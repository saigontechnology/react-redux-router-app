import { Observable } from 'rxjs/Observable';
import flow from 'lodash.flow';

/**
 *  Wrapper for Fetch API (https://developer.mozilla.org/en/docs/Web/API/Fetch_API)
 *  The purpose of this is to enhance `fetch()` but still remain its API,
 *  except the result data are converted into JSON which is inspired by Angular 1's $http service.
 *  Enhanced features:
 *    - Convert response data to json implicitly.
 *    - Provide .addDefaultHeader() to setup default headers.
 *    - Interceptors - do something before or after every request.
 *    - Retry (GET only) on error.
 *    - Some utils method to parse request data.
 *  Future note: Above features can be considerd implemented by service worker
 *  when it is supported by all major browsers.
 *  Usage sample:
 *    const [data, status] = await fetchHelper.fetch('http://my.api.com/do-sth', {
 *      method: 'POST',
 *      body: JSON.stringify({id: 1, name: 'ABC'})
 *    })
 */
class FetchHelper {
  // CONFIGURATION
  static RETRY = true;
  static MAX_RETRY = 3;
  static RETRY_DELAY = 500;
  // END OF CONFIGURATION

  FORM_URL_ENCODED = 'application/x-www-form-urlencoded';

  constructor() {
    this.defaultInit = {
      credentials: 'include'
    };
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
    this.beforeRequestInterceptors = [];
    this.afterResponseInterceptors = [];
  }

  addDefaultHeader = (key, value) => {
    this.defaultHeaders[key] = value;
  };

  removeDefaultHeader = key => {
    delete this.defaultHeaders[key];
  };
  /**
   *  To define something to do before every fetch request.
   *  Params:
   *      TBD
   *  Result:
   *      Returns a function to remove added interceptor.
   */
  addBeforeRequestInterceptor = interceptor => {
    this.beforeRequestInterceptors.push(interceptor);
    return () => {
      const index = this.beforeRequestInterceptors.indexOf(interceptor);
      this.beforeRequestInterceptors.splice(index, 1);
    };
  };
  /**
   *  To define something to do after every fetch response.
   *  If one of interceptors returns false, the process will be stop immediately.
   *  Params:
   *      interceptor: function (response)
   *  Result:
   *      Returns a function to remove added interceptor.
   */
  addAfterResonseInterceptor = interceptor => {
    this.afterResponseInterceptors.push(interceptor);
    return () => {
      const index = this.afterResponseInterceptors.indexOf(interceptor);
      this.afterResponseInterceptors.splice(index, 1);
    };
  };
  jsonToForm(json = {}) {
    return Object.keys(json)
      .map(key => {
        return encodeURIComponent(key) + '=' + encodeURIComponent(json[key]);
      })
      .join('&');
  }
  jsonToQueryString(json = {}) {
    return Object.keys(json)
      .map(key => {
        const value = json[key];
        if (value && value.constructor === Array) {
          return value
            .map(valueItem => `${key}=${encodeURIComponent(valueItem)}`)
            .join('&');
        } else if (value || value === 0) {
          return `${key}=${encodeURIComponent(value)}`;
        } else {
          return '';
        }
      })
      .filter(Boolean)
      .join('&');
  }

  fetch = async (input, init = {}) => {
    let initWithDefaultHeaders = {
      ...this.defaultInit,
      ...init,
      headers: mergeWithDefaultHeaders(init.headers, this.defaultHeaders)
    };

    //run interceptors before each request
    let beforeRequestInterceptorsResult = applyBeforeRequestInterceptors(
      this.beforeRequestInterceptors
    );
    if (beforeRequestInterceptorsResult === false) {
      throw new Error(
        'Fetch Promise was canceled by interceptor before requested'
      );
    }
    let response;

    // run fetch() to request api...
    try {
      //...create difference kind of fetches to handle errors
      const customFetch = flow([
        this._fetchWith5XXRetry
        //this._fetchWith401Retry // TODO - implement refresh access token here (?)
      ])(fetch);

      response = await customFetch(input, initWithDefaultHeaders);
    } catch (e) {
      console.warn('[FetchHelper]', e);
      applyAfterResponseInterceptors(e, this.afterResponseInterceptors);
      return [e, -1];
    }

    //handle response
    const responseStatus = response.status;
    let jsonData = null;
    try {
      jsonData = await response.json();

      // run interceptors after each requests
      let afterResponseInterceptorsResult = applyAfterResponseInterceptors(
        response,
        this.afterResponseInterceptors,
        jsonData
      );
      if (afterResponseInterceptorsResult === false) {
        throw new Error(
          'Fetch Promise was canceled by interceptor after responded'
        );
      }
      return [jsonData, responseStatus];
    } catch (e) {
      if (!jsonData) {
        let afterResponseInterceptorsResult = applyAfterResponseInterceptors(
          response,
          this.afterResponseInterceptors,
          jsonData,
          initWithDefaultHeaders
        );
        if (afterResponseInterceptorsResult === false) {
          throw new Error(
            'Fetch Promise was canceled by interceptor after responded'
          );
        }
      }
      if (!(responseStatus + '').startsWith('2'))
        console.warn(
          `Can not parse json from response of API "${input}" with code ${responseStatus}.`,
          e
        );
      return [response, responseStatus];
    }
  };
  uploadFile = (url, opts = {}, onProgress) => {
    return new Promise((res, rej) => {
      var xhr = new XMLHttpRequest();
      xhr.open(opts.method || 'post', url);
      const headers = opts.headers || {};
      for (var k in headers) xhr.setRequestHeader(k, headers[k]);
      xhr.onload = e => {
        try {
          const json = JSON.parse(e.target.responseText);
          res([json, xhr.status]);
        } catch (err) {
          res([e.target.responseText, xhr.status]);
        }
      };
      xhr.onerror = rej;
      xhr.withCredentials = true;
      if (xhr.upload && onProgress) xhr.upload.onprogress = onProgress; // event.loaded / event.total * 100 ; //event.lengthComputable
      xhr.send(opts.body);
    });
  };
  getHeader = () => {
    return this.defaultHeaders;
  };
  _fetchWith5XXRetry = previousFetch => (input, init = {}) => {
    if (
      FetchHelper.RETRY &&
      (!init.method || init.method.toUpperCase() === 'GET')
    ) {
      let count = 0;

      return Observable.defer(() =>
        Observable.fromPromise(
          previousFetch(input, init).then(response => {
            if ((response.status + '').startsWith('5')) throw response;
            return response;
          })
        )
      )
        .retryWhen(errors => {
          return errors.mergeMap(error => {
            if (++count >= FetchHelper.MAX_RETRY) {
              return Observable.throw(error);
            }
            return Observable.of(error).delay(FetchHelper.RETRY_DELAY);
          });
        })
        .toPromise()
        .then(
          response => response,
          response => {
            if (response.status === 500) return response;
            throw response;
          }
        );
    } else {
      return previousFetch(input, init);
    }
  };
}

/*** PRIVATE METHODS: ***/

function mergeWithDefaultHeaders(headers = {}, defaultHeaders) {
  var headerObj = {};
  if (headers instanceof Headers) {
    headers.forEach(([key, value]) => {
      headerObj[key] = value;
    });
  } else {
    headerObj = headers;
  }

  return Object.assign({}, defaultHeaders, headerObj);
}

function applyBeforeRequestInterceptors(interceptors) {
  interceptors.forEach(interceptor => {
    try {
      const interceptorResult = interceptor();
      if (interceptorResult === false) {
        console.error(
          'Interceptor ',
          interceptor,
          ' has cancel signal. This makes the request stop immediately.'
        );
        return false;
      }
    } catch (e) {
      console.error(`[FetchHelper] Error from interceptor ${interceptor}`, e);
      return false;
    }
  });
}

function applyAfterResponseInterceptors(
  response,
  interceptors,
  jsonData,
  initWithDefaultHeaders
) {
  interceptors.forEach(interceptor => {
    try {
      const interceptorResult = interceptor(
        response,
        jsonData,
        initWithDefaultHeaders
      );
      if (interceptorResult === false) {
        console.error(
          'Interceptor ',
          interceptor,
          ' has cancel signal. This makes the request stop immediately.'
        );
        return false;
      }
    } catch (e) {
      console.error(`[FetchHelper] Error from interceptor ${interceptor}`, e);
      return false;
    }
  });
}

const fetchHelper = new FetchHelper();

export default fetchHelper;
