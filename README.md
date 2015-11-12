rapidapi
========

Store your stuff, rapidly ... rapidapidly.
---------------------------------------

*A docroot-like API, which lets storing &amp; retrieving your stuff get out of your way.*

_Version 1.0 of rapidapi supported schema-less object storage with dehydrated lists - this functionality has been removed, but can still be found in branch 1.0.12_

##INSTALL

- Install node.js. Head to the [node.js download page](http://nodejs.org/download/), and download and install the latest stable version.

- In your code: (remember to replace REDIS_HOST, REDIS_PORT, and SERVER_PORT with your own config)

```
    var rapidapi = require ( 'rapidapi' );
    var config = {
        routeRoot: './routes'
    };

    rapidapi ( config, function ( error, server ) {
        if ( error ) {
            return console.error ( error );
        }

        console.log ( 'ready' );
    } );

```

Just like that, you're ready to store your stuff!

##DOCROOT model

If the *docRoot* attribute is provided in the configuration parameter, its value is taken to be a folder relative to rapidapi's module parent. This folder is then parsed recursively, and its contents is exposed as API endpoints, like a directory tree would be exposed on a web server.

If it is not provided, it defaults to *routes*.

If a file in this structure is called *index.js*, its associated endpoint will be the path it is in. Otherwise, the filename will act as a resource parameter, and exposed as such in the request attribute

```
    req.params
```

If more than one request parameter is needed, the filename becomes the request parameters, in order, separated by dashes.

**For example:**

```
*docRoot*/index.js -> /
*docRoot*/param1.js -> /:param1
*docRoot*/param1-param2.js -> /:param1/:param2
*docRoot*/resource/index.js -> /resource/
*docRoot*/resource/param1.js -> /resource/
*docRoot*/resource/param1-param2.js -> /resource/:param1/:param2
```

Files in this directory are node modules, and should export a function for each method it wants to support on the endpoint. This function (called the *request handler*), accepts two parameters, the request object, and a callBack function.

The callBack function accepts an error parameter as its first argument. If this error is a string, it is returned with HTTP status 500.

If any other HTTP code is to be returned, error has to be structured as follows:

```
    {
        type: ERRORTYPE,
        message: ERRORMESSAGE
    }
```

Viable error messages are:

```
{
    400: 'BadRequestErrorError',
    401: 'UnauthorizedError',
    402: 'PaymentRequiredError',
    403: 'ForbiddenError',
    404: 'NotFoundError',
    405: 'MethodNotAllowedError',
    406: 'NotAcceptableError',
    407: 'ProxyAuthenticationRequiredError',
    408: 'RequestTimeoutError',
    409: 'ConflictError',
    410: 'GoneError',
    411: 'LengthRequiredError',
    412: 'PreconditionFailedError',
    413: 'RequestEntityTooLargeError',
    414: 'RequestUriTooLargeError',
    415: 'UnsupportedMediaTypeError',
    416: 'RequestedRangeNotSatisfiableError',
    417: 'ExpectationFailedError',
    418: 'ImATeapotError',              // RFC 2324
    422: 'UnprocessableEntityError',    // RFC 4918
    423: 'LockedError',                 // RFC 4918
    424: 'FailedDependencyError',       // RFC 4918
    425: 'UnorderedCollectionError',    // RFC 4918
    426: 'UpgradeRequiredError',        // RFC 2817
    500: 'InternalServerErrorError',
    501: 'NotImplementedError',
    502: 'BadGatewayError',
    503: 'ServiceUnavailableError',
    504: 'GatewayTimeoutError',
    505: 'HttpVersionNotSupportedError',
    506: 'VariantAlsoNegotiatesError',  // RFC 2295
    507: 'InsufficientStorageError',    // RFC 4918
    509: 'BandwidthLimitExceededError',
    510: 'NotExtendedError'             // RFC 2774
};
```

Error can also be structure as such:

```
    {
        code: HTTPCODE,
        message: ERRORMESSAGE
    }
```

HTTPCODE can be replaced by an explicit HTTP code to return with the error message.


**handler example:**

In a file stored in **docRoot**/divide/numerator-denominator.js:

```
module.exports = {
    get: function ( req, callBack ) {
        var n = parseInt ( req.params.numerator, 10 );
        var d = parseInt ( req.params.denominator, 10 );

        if ( d === 6379 ) {
            return callBack ( {
                code: 201,
                message: 'Easter egg!'
            } );
        }

        if ( d === 0  ) {
            return callBack ( {
                type: 'NotAcceptableError',
                message: 'Divide by zero error'
            } );
        }

        return callBack ( null, n/d );
    }
};
```
