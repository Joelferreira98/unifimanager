UniFi Network API (10.4.57)
Getting Started
Provides an overview of the UniFi Network API, including authentication using API keys and request format. Start here to understand how to connect and make your first request.

Introduction
Each UniFi Application has its own API endpoints running locally on each site, offering detailed analytics and control related to that specific application. For a single endpoint with high-level insights across all your UniFi sites, refer to the UniFi Site Manager API.

Authentication and Request Format
An API Key is a unique identifier used to authenticate API requests. To generate API Keys and view an example of the API Request Format, visit the Integrations section of your UniFi application.

Filtering
Explains how to use the filter query parameter for advanced querying across list endpoints, including supported property types, syntax, and operators.

Some GET and DELETE endpoints support filtering using the filter query parameter. Each endpoint supporting filtering will have a detailed list of filterable properties, their types, and allowed functions.

Filtering Syntax
Filtering follows a structured, URL-safe syntax with three types of expressions.

1. Property Expressions
Apply functions to an individual property using the form <property>.<function>(<arguments>), where argument values are separated by commas.

Examples:

id.eq(123) checks if id is equal to 123;
name.isNotNull() checks if name is not null;
createdAt.in(2025-01-01, 2025-01-05) checks if createdAt is either 2025-01-01 or 2025-01-05.
2. Compound Expressions
Combine two or more expressions with logical operators using the form <logical-operator>(<expressions>), where expressions are separated by commas.

Examples:

and(name.isNull(), createdAt.gt(2025-01-01)) checks if name is null and createdAt is greater than 2025-01-01;
or(name.isNull(), expired.isNull(), expiresAt.isNull()) check is any of name, expired, or expiresAt is null.
3. Negation Expressions
Negate any other expressions using the the form not(<expression>).

Example:

not(name.like('guest*')) matches all values except those that start with guest.
Filterable Property Types
The table below lists all supported property types.

Type	Examples	Syntax
STRING	'Hello, ''World''!'	Must be wrapped in single quotes. To escape a single quote, use another single quote.
INTEGER	123	Must start with a digit.
DECIMAL	123, 123.321	Must start with a digit. Can include a decimal point (.).
TIMESTAMP	2025-01-29, 2025-01-29T12:39:11Z	Must follow ISO 8601 format (date or date-time).
BOOLEAN	true, false	Can be true or false.
UUID	550e8400-e29b-41d4-a716-446655440000	Must be a valid UUID format (8-4-4-4-12).
SET(STRING|INTEGER|DECIMAL|TIMESTAMP|UUID)	[1, 2, 3, 4, 5]	A set of (unique) values.
Filtering Functions
The table below lists available filtering functions, their arguments, and applicable property types:

Function	Arguments	Semantics	Supported property types
isNull	0	is null	all types
isNotNull	0	is not null	all types
eq	1	equals	STRING, INTEGER, DECIMAL, TIMESTAMP, BOOLEAN, UUID
ne	1	not equals	STRING, INTEGER, DECIMAL, TIMESTAMP, BOOLEAN, UUID
gt	1	greater than	STRING, INTEGER, DECIMAL, TIMESTAMP, UUID
ge	1	greater than or equals	STRING, INTEGER, DECIMAL, TIMESTAMP, UUID
lt	1	less than	STRING, INTEGER, DECIMAL, TIMESTAMP, UUID
le	1	less than or equals	STRING, INTEGER, DECIMAL, TIMESTAMP, UUID
like	1	matches pattern	STRING
in	1 or more	one of	STRING, INTEGER, DECIMAL, TIMESTAMP, UUID
notIn	1 or more	not one of	STRING, INTEGER, DECIMAL, TIMESTAMP, UUID
isEmpty	0	is empty	SET
contains	1	contains	SET
containsAny	1 or more	contains any of	SET
containsAll	1 or more	contains all of	SET
containsExactly	1 or more	contains exactly	SET
Pattern Matching (like Function)
The like function allows matching string properties using simple patterns:

. matches any single character. Example: type.like('type.') matches type1, but not type100;
* matches any number of characters. Example: name.like('guest*') matches guest1 and guest100;
\ is used to escape . and *.
Error Handling
Describes the standard API error response structure, including error codes, status names, and troubleshooting guidance.

Error Message
statusCode	
integer <int32>
statusName	
string
code	
string
message	
string
timestamp	
string <date-time>
requestPath	
string
requestId	
string <uuid>
In case of Internal Server Error (core = 500), request ID can be used to track down the error in the server log


Copy
{
"statusCode": 400,
"statusName": "UNAUTHORIZED",
"code": "api.authentication.missing-credentials",
"message": "Missing credentials",
"timestamp": "2024-11-27T08:13:46.966Z",
"requestPath": "/integration/v1/sites/123",
"requestId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
Application Info
Returns general details about the UniFi Network application, including version and runtime metadata. Useful for integration validation.

Get Application Info
Retrieve general information about the UniFi Network application.

Responses

200
OK


get
/v1/info
Response samples
200

Copy
{
"applicationVersion": "9.1.0"
}
Sites
Endpoints for listing and managing UniFi sites within a local Network application. Site ID is required for most other API requests.

List Local Sites
Retrieve a paginated list of local sites managed by this Network application. Site ID is required for other UniFi Network API calls.

Filterable properties (click to expand)
query Parameters
offset	
integer <int32> >= 0
Default: 0
limit	
integer <int32> [ 0 .. 200 ]
Default: 25
filter	
string
Responses

200
OK

Clients
Endpoints for viewing and managing connected clients (wired, wireless, VPN, and guest). Supports actions such as authorizing or unauthorizing guest access.

Execute Client Action
Perform an action on a specific connected client. The request body must include the action name and any applicable input arguments.

path Parameters
clientId
required
string <uuid>
siteId
required
string <uuid>
Request Body schema: application/json
required
action
required
string

AUTHORIZE_GUEST_ACCESS
AUTHORIZE_GUEST_ACCESS
timeLimitMinutes	
integer <int64> [ 1 .. 1000000 ]
(Optional) how long (in minutes) the guest will be authorized to access the network. If not specified, the default limit is used from the site settings

dataUsageLimitMBytes	
integer <int64> [ 1 .. 1048576 ]
(Optional) data usage limit in megabytes

rxRateLimitKbps	
integer <int64> [ 2 .. 100000 ]
(Optional) download rate limit in kilobits per second

txRateLimitKbps	
integer <int64> [ 2 .. 100000 ]
(Optional) upload rate limit in kilobits per second

Responses

200
OK


post
/v1/sites/{siteId}/clients/{clientId}/actions
Request samples
Payload
Example

AUTHORIZE_GUEST_ACCESS
AUTHORIZE_GUEST_ACCESS

Copy
{
"action": "AUTHORIZE_GUEST_ACCESS",
"timeLimitMinutes": 1,
"dataUsageLimitMBytes": 1,
"rxRateLimitKbps": 2,
"txRateLimitKbps": 2
}
Response samples
200
Example

AUTHORIZE_GUEST_ACCESS
AUTHORIZE_GUEST_ACCESS

Copy
Expand allCollapse all
{
"action": "AUTHORIZE_GUEST_ACCESS",
"revokedAuthorization": {
"authorizedAt": "2019-08-24T14:15:22Z",
"authorizationMethod": "VOUCHER",
"expiresAt": "2019-08-24T14:15:22Z",
"dataUsageLimitMBytes": 1024,
"rxRateLimitKbps": 1000,
"txRateLimitKbps": 1000,
"usage": {}
},
"grantedAuthorization": {
"authorizedAt": "2019-08-24T14:15:22Z",
"authorizationMethod": "VOUCHER",
"expiresAt": "2019-08-24T14:15:22Z",
"dataUsageLimitMBytes": 1024,
"rxRateLimitKbps": 1000,
"txRateLimitKbps": 1000,
"usage": {}
}
}
List Connected Clients
Retrieve a paginated list of all connected clients on a site, including physical devices (computers, smartphones) and active VPN connections.

Filterable properties (click to expand)
path Parameters
siteId
required
string <uuid>
query Parameters
offset	
integer <int32> >= 0
Default: 0
limit	
integer <int32> [ 0 .. 200 ]
Default: 25
filter	
string
Responses

200
OK


get
/v1/sites/{siteId}/clients
Response samples
200

Copy
Expand allCollapse all
{
"offset": 0,
"limit": 25,
"count": 10,
"totalCount": 1000,
"data": [
{}
]
}
Get Connected Client Details
Retrieve detailed information about a specific connected client, including name, IP address, MAC address, connection type and access information.

path Parameters
clientId
required
string <uuid>
siteId
required
string <uuid>
Responses

200
OK

Response Schema: application/json
type
required
string

WIRED
WIRED
id
required
string <uuid>
name
required
string
connectedAt	
string <date-time>
ipAddress	
string
access
required
object
Represents the type of network access and/or any applicable authorization status the client is using.

Wired clients may have direct access without additional authorization.
Wireless clients can be connected via a protected network or an open network that may require additional authorization (e.g., a guest portal).
VPN clients may have different authorization mechanisms.
Currently, the only two supported access types are GUEST (used for wired and wireless guest clients) and DEFAULT (a placeholder, which might be refined in the future releases, used for all other clients).

Filtering is possible by access.type, for example access.type.eq('GUEST') to list guest clients.

macAddress
required
string
uplinkDeviceId
required
string <uuid>

Filterable properties (click to expand)
Name	Type	Allowed functions
id	UUID	eq ne in notIn
createdAt	TIMESTAMP	eq ne gt ge lt le
name	STRING	eq ne in notIn like
code	STRING	eq ne in notIn
authorizedGuestLimit	INTEGER	isNull isNotNull eq ne gt ge lt le
authorizedGuestCount	INTEGER	eq ne gt ge lt le
activatedAt	TIMESTAMP	eq ne gt ge lt le
expiresAt	TIMESTAMP	eq ne gt ge lt le
expired	BOOLEAN	eq ne
timeLimitMinutes	INTEGER	eq ne gt ge lt le
dataUsageLimitMBytes	INTEGER	isNull isNotNull eq ne gt ge lt le
rxRateLimitKbps	INTEGER	isNull isNotNull eq ne gt ge lt le
txRateLimitKbps	INTEGER	isNull isNotNull eq ne gt ge lt le
path Parameters
siteId
required
string <uuid>
query Parameters
filter
required
string
Responses

200
OK

Response Schema: application/json
vouchersDeleted	
integer <int64>

delete
/v1/sites/{siteId}/hotspot/vouchers
Response samples
200

Copy
{
"vouchersDeleted": 0
}
Get Voucher Details
Retrieve details of a specific Hotspot voucher.

path Parameters
voucherId
required
string <uuid>
siteId
required
string <uuid>
Responses

200
OK

Response Schema: application/json
id
required
string <uuid>
createdAt
required
string <date-time>
name
required
string
Voucher note, may contain duplicate values across multiple vouchers

code
required
string
Secret code to active the voucher using the Hotspot portal

authorizedGuestLimit	
integer <int64>
(Optional) limit for how many different guests can use the same voucher to authorize network access

authorizedGuestCount
required
integer <int64>
For how many guests the voucher has been used to authorize network access

activatedAt	
string <date-time>
(Optional) timestamp when the voucher has been activated (authorization time of the first guest)

expiresAt	
string <date-time>
(Optional) timestamp when the voucher will become expired. All guests using the voucher will be unauthorized from network access

expired
required
boolean
Whether the voucher has been expired and can no longer be used to authorize network access

timeLimitMinutes
required
integer <int64>
How long (in minutes) the voucher will provide access to the network since authorization of the first guest. Subsequently connected guests, if allowed, will share the same expiration time.

dataUsageLimitMBytes	
integer <int64>
(Optional) data usage limit in megabytes

rxRateLimitKbps	
integer <int64>
(Optional) download rate limit in kilobits per second

txRateLimitKbps	
integer <int64>
(Optional) upload rate limit in kilobits per second


get
/v1/sites/{siteId}/hotspot/vouchers/{voucherId}
Response samples
200

Copy
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"createdAt": "2019-08-24T14:15:22Z",
"name": "hotel-guest",
"code": 4861409510,
"authorizedGuestLimit": 1,
"authorizedGuestCount": 0,
"activatedAt": "2019-08-24T14:15:22Z",
"expiresAt": "2019-08-24T14:15:22Z",
"expired": true,
"timeLimitMinutes": 1440,
"dataUsageLimitMBytes": 1024,
"rxRateLimitKbps": 1000,
"txRateLimitKbps": 1000
}
Delete Voucher
Remove a specific Hotspot voucher.

path Parameters
voucherId
required
string <uuid>
siteId
required
string <uuid>
Responses

200
OK

Response Schema: application/json
vouchersDeleted	
integer <int64>
