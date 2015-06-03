#!/bin/sh
redis-cli del object:12345
redis-cli del object:23456
redis-cli zremrangebyscore objects -inf inf
redis-cli zremrangebyscore someObjects -inf inf
redis-cli zremrangebyscore otherObjects -inf inf
echo ""
echo "Should fail"
curl -X PUT -d @object6.js http://localhost:5000/object/12345
echo ""
echo "Should succeed"
curl -X POST -d @object6.js http://localhost:5000/object/12345
echo ""
echo "Should return object"
curl http://localhost:5000/object/12345
echo ""
echo "==============================="
echo ""
echo "Should succeed"
curl -X PUT -d @object7.js http://localhost:5000/object/12345
echo ""
echo "Should fail"
curl -X POST -d @object7.js http://localhost:5000/object/12345
echo ""
echo "Should return object - with name Updated"
curl http://localhost:5000/object/12345
echo ""
echo "==============================="
echo ""
echo "Should succeed"
curl -X DELETE http://localhost:5000/object/12345
echo ""
echo "Should return 404"
curl http://localhost:5000/object/12345
echo ""
echo "==============================="
echo ""
echo "Should be empty"
redis-cli keys "*bject*"
