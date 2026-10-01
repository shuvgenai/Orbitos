# The instance's engine container: Paperclip plus Hermes in one image.
# Both must share a container because Paperclip's hermes_local adapter spawns a local
# hermes binary (Eng v3 D3). Refs come from template/engine/pinned-versions.json.
#
# Paperclip is the base: it carries Node 24.21, tini and the entrypoint that drops privileges.
# Hermes moves in whole, because everything it needs sits under /opt/hermes and /opt/data.
# Both images are Debian 13 with CPython 3.13.5 at /usr/bin/python3, which is the interpreter
# the Hermes venv points at (pyvenv.cfg home = /usr/bin), so the venv survives the copy.
ARG PAPERCLIP_REF
ARG HERMES_REF

FROM ${HERMES_REF} AS hermes

FROM ${PAPERCLIP_REF} AS runtime

# /opt/hermes holds the CLI, its Python venv and the Playwright pack. /opt/data is Hermes' own
# data root (HERMES_HOME); it is a mount point at runtime, created here so the entrypoint can
# write into it before the volume is populated.
COPY --from=hermes /opt/hermes /opt/hermes
# Ownership is set at build time as well as in the entrypoint: Docker seeds a fresh named volume
# from the image path, so /opt/data arrives already writable by the uid that runs the adapter.
RUN mkdir -p /opt/data/profiles && chown -R "${USER_UID:-1000}:${USER_GID:-1000}" /opt/data

# Hermes resolves its CLI and venv through PATH, and keys every data path off HERMES_HOME.
ENV PATH="/opt/hermes/bin:/opt/hermes/.venv/bin:${PATH}" \
    HERMES_HOME=/opt/data \
    HERMES_WRITE_SAFE_ROOT=/opt/data \
    HERMES_DISABLE_LAZY_INSTALLS=1 \
    HERMES_LAZY_INSTALL_TARGET=/opt/data/lazy-packages \
    HERMES_WEB_DIST=/opt/hermes/hermes_cli/web_dist \
    HERMES_TUI_DIR=/opt/hermes/ui-tui \
    PLAYWRIGHT_BROWSERS_PATH=/opt/hermes/.playwright \
    XDG_RUNTIME_DIR=/tmp/hermes-runtime

COPY hermes/orbi.config.yaml /engine/config/orbi.config.yaml
COPY hermes/scout.config.yaml /engine/config/scout.config.yaml
COPY entrypoint.sh /engine/entrypoint.sh
RUN chmod +x /engine/entrypoint.sh

# No USER line: the base image starts as root by design and drops to USER_UID in its own
# entrypoint, /usr/local/bin/docker-entrypoint.sh. PAPERCLIP_HOME stays the image default,
# /paperclip. Setting ENTRYPOINT resets the inherited CMD, so the base image's command is
# restated here verbatim and passed through by entrypoint.sh.
ENTRYPOINT ["/engine/entrypoint.sh"]
CMD ["node", "--import", "./server/node_modules/tsx/dist/loader.mjs", "server/dist/index.js"]
