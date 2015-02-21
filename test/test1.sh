#!/bin/sh
redis-cli del object:12345
redis-cli del object:23456
redis-cli zremrangebyscore objects -inf inf
redis-cli zremrangebyscore someObjects -inf inf
redis-cli zremrangebyscore otherObjects -inf inf
echo ""
echo "Should succeed"
curl -X POST -d @object1.js http://localhost:5000/object/12345
echo ""
echo "Should return object"
curl http://localhost:5000/object/12345
echo ""
echo "Should contain 1 object"
curl http://localhost:5000/objects
echo ""
echo "==============================="
echo ""
echo "Should succeed"
curl -X DELETE http://localhost:5000/object/12345
echo ""
echo "Should return 404"
curl http://localhost:5000/object/12345
echo ""
echo "Should be empty"
curl http://localhost:5000/objects
echo ""
echo "Should be empty"
redis-cli zrange objects 0 -1
echo ""
echo "==============================="


