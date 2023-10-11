FROM registry.access.redhat.com/ubi9/nodejs-18:latest

USER root

RUN yum install -y \
    python3-pip \
    git \
    less \
    && dnf clean all

ENV APP_ROOT=/usr/src/app
WORKDIR $APP_ROOT

COPY requirements.txt tsconfig.json package.json package-lock.json app.yml $APP_ROOT/
COPY src $APP_ROOT/src/
COPY views $APP_ROOT/views/

RUN npm ci
RUN npm run build
RUN chgrp -R 0 $APP_ROOT && chmod -R g+rwX $APP_ROOT && \
    # the following is to fix https://issues.redhat.com/browse/AAP-15887
    mkdir /.npm && chgrp -R 0 /.npm && chmod -R g+rwX /.npm
RUN pip install -r ./requirements.txt

USER 1000

EXPOSE 3000

CMD ["npm", "start"]
