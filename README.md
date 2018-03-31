[ ![rotorlab/server-node](https://d25lcipzij17d.cloudfront.net/badge.svg?id=js&type=6&v=0.0.1&x2=0)](https://www.npmjs.com/package/rotor-server)
<p align="center"><img width="10%" vspace="20" src="https://github.com/rotorlab/database-kotlin/raw/develop/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png"></p>

# Rotor Server for Node

Rotor is a communication framework for work with remote objects from different devices. It makes the API development task easier removing all getter/setter requests. Client data changes are replicated in all devices listening the same object.

[1. Redis](https://github.com/rotorlab/server-node/wiki/Redis)

[2. Implementation](https://github.com/rotorlab/server-node/wiki/Implementation)

[3. Start](https://github.com/rotorlab/server-node/wiki/Start)

[4. Paths and models](https://github.com/rotorlab/server-node/wiki/Paths-and-models)

[5. Libraries](https://github.com/rotorlab/server-node/wiki/Libraries)


Here you can find all info about how to build a simple API with few lines.

**Rotor philosophy** states that the only needed requests are those that change data on databases. That means that the rest of requests you are imaging are replaced.

![schema](https://github.com/rotorlab/server-node/raw/feature/mongodb/schema.png)

Rotor libraries are connected to Rotor and Redis servers. The first one controls object sharing queues, devices waiting for changes and all data edition on remote database. The second gives us Pub/Sub messaging pattern for data changes replication.

When devices make changes in objects, client libraries send generated differences to Rotor server. This differences are applied in database and replicated on the rest of devices which are listening the same object.

Check [paths page](https://github.com/rotorlab/server-node/wiki/Paths-and-models) for more info.

License
-------
    Copyright 2018 RotorLab Organization

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.