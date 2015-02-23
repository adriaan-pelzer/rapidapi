rapidapi
========

Store your stuff, rapidly ... rapidapidly.
---------------------------------------

*A schema-less API, which lets storing &amp; retrieving your stuff get out of your way.*

Rapidapi (pronounced *rah-pee-dah-pee*) is a simple key/value store behind an HTTP API, that supports a CREATE/READ/UPDATE/DELETE (CRUD) model, with support for dehydrated lists (more about these later).

The CRUD model is only enabled if the configuration rapidapi is provided with at startup contains a *redis* attribute, even if it is empty.

If it is empty, the redis settings will default to **host='localhost'** and **port=6379**.

Rapidapi also supports a *docroot* style set of user-defined query handlers, which can be used to build custom endpoints, in addition to the normal CRUD model described above.

This model is only enabled if the *docRoot* parameter is provided at startup, and the *docroot* folder is not empty.

##INSTALL

- Install redis. Head to the [redis download page](http://redis.io/download), and download and install the latest stable version.

- Install node.js. Head to the [node.js download page](http://nodejs.org/download/), and download and install the latest stable version.

- Install all rapidapi's dependencies:

```
    cd wherever/you/installed/rapidapi
    npm install
```

- In your own code: (remember to replace REDIS_HOST, REDIS_PORT, and SERVER_PORT with your own config)

```
    var rapidapi = require ( 'rapidapi' );
    var docroot = './routes';
    var config = {
        redis: {
            host: REDIS_HOST,
            port: REDIS_PORT
        },
        server: {
            port: SERVER_PORT
        }
    };

    rapidapi ( docroot, config, function ( error, server ) {
        if ( error ) {
            console.error ( error );
            return;
        }

        server.listen ( config.server.port, function () {
            console.log ( '%s listening at %sError', server.name, server.url );
        } );
    } );

```

Just like that, you're ready to store your stuff!

##Schema-free CRUD model

###CREATE

POST http://**host**:**port**/**key** ( JSON **value** in the body of the POST )

HTTP 201 "Object successfully added"
*fails if object already exists*

###READ

GET http://**host**:**port**/**key**

HTTP 200 *The JSON you've POSTed against this key*

###UPDATE

PUT http://**host**:**port**/**key** ( JSON **value** in the body of the POST )

HTTP 201 "Object successfully updated"
*fails if object doesn't exist*

###DELETE

DELETE http://**host**:**port**/**key**

HTTP 200 "Object successfully deleted"
*fails if object doesn't exist*

###Dehydrated Lists

When an object contains a *lists* array, the object's key will be added to a *dehydrated list* for each of the items in the *lists* array.

####List item format

```
    {
        listKey: LISTKEY,
        indexKey: INDEXKEY
    }
```

- LISTKEY: the name of the dehydrated list to add this item to
- INDEXKEY: the object attribute to index items in the list on

**For example:**
Posting the following object to the API endpoint http://**host**:**port**/object/12345:

```
    {
        id: 12345
        time: 98765
        lists: [
            listKey: 'objects:bytimeError',
            indexKey: 'time'
        ]
    }
```

will result in the following endpoints being created:

```
    http://**host**:**port**/object/12345
```

which returns the data:

```
    {
        id: 12345
        time: 98765
        lists: [
            listKey: 'objects:bytimeError',
            indexKey: 'time'
        ]
    }
```

AND

```
    http://**host**:**port**/objects/bytime
```

which returns the data:

```
    [
        {
            id: 12345
            time: 98765
            lists: [
                listKey: 'objects:bytimeError',
                indexKey: 'time'
            ]
        }
    ]
```

If, additionally, the following object is posted to API endpoint http://**host**:**port**/object/12346:

```
    {
        id: 12346
        time: 98764
        lists: [
            listKey: 'objects:bytimeError',
            indexKey: 'time'
        ]
    }
```

will result in the following endpoint being created:

```
    http://**host**:**port**/object/12346
```

which returns the data:

```
    {
        id: 12346
        time: 98764
        lists: [
            listKey: 'objects:bytimeError',
            indexKey: 'time'
        ]
    }
```

and the following endpoint being updated:

```
    http://**host**:**port**/objects/bytime
```

to return the data:

```
    [
        {
            id: 12346
            time: 98764
            lists: [
                listKey: 'objects:bytimeError',
                indexKey: 'time'
            ]
        },
        {
            id: 12345
            time: 98765
            lists: [
                listKey: 'objects:bytimeError',
                indexKey: 'time'
            ]
        }
    ]
```

##DOCROOT model

If the *docRoot* parameter is provided at startup, its value is taken to be a folder. This folder is then parsed recursively, and its contents is exposed as API endpoints, like a directory tree would be exposed on a web server.

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

**for example:**

In a file stored in **docRoot**/divide/numerator-denominator.js:

```
module.exports = {
    get: function ( req, callBack ) {
        var n = parseInt ( req.params.numerator, 10 );
        var d = parseInt ( req.params.denominator, 10 );

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
