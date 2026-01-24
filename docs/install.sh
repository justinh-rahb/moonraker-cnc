#!/bin/bash
# Retro CNC Panel Installer
# Usage: curl -sSL https://raw.githubusercontent.com/justinh-rahb/moonraker-cnc/main/docs/install.sh | bash

set -e

REPO="justinh-rahb/moonraker-cnc"
INSTALL_DIR="${HOME}/retro-cnc-panel"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
NGINX_CONF="retro-cnc-panel"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════╗"
    echo "║       RETRO CNC PANEL INSTALLER           ║"
    echo "╚═══════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${CYAN}→ $1${NC}"
}

check_dependencies() {
    print_info "Checking dependencies..."

    local missing=()

    for cmd in curl unzip; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done

    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing[*]}"
        echo "Install them with: sudo apt-get install ${missing[*]}"
        exit 1
    fi

    print_success "All dependencies satisfied"
}

get_latest_version() {
    print_info "Fetching latest release version..."

    LATEST_VERSION=$(curl -sSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')

    if [ -z "$LATEST_VERSION" ]; then
        print_error "Could not determine latest version"
        exit 1
    fi

    # Strip 'v' prefix if present for display
    VERSION_NUM="${LATEST_VERSION#v}"
    print_success "Latest version: ${VERSION_NUM}"
}

download_and_install() {
    print_info "Downloading Retro CNC Panel ${VERSION_NUM}..."

    local download_url="https://github.com/${REPO}/releases/download/${LATEST_VERSION}/retro-cnc-panel-${VERSION_NUM}.zip"
    local temp_dir=$(mktemp -d)
    local zip_file="${temp_dir}/retro-cnc-panel.zip"

    if ! curl -sSL -o "$zip_file" "$download_url"; then
        print_error "Failed to download release"
        rm -rf "$temp_dir"
        exit 1
    fi

    print_success "Downloaded successfully"

    # Backup existing installation if present
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "Existing installation found, backing up..."
        mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%Y%m%d%H%M%S)"
    fi

    # Create install directory and extract
    print_info "Installing to ${INSTALL_DIR}..."
    mkdir -p "$INSTALL_DIR"
    unzip -q "$zip_file" -d "$INSTALL_DIR"

    # Cleanup
    rm -rf "$temp_dir"

    print_success "Installation complete"
}

setup_nginx() {
    if ! command -v nginx &> /dev/null; then
        print_warning "nginx not found, skipping web server configuration"
        echo "  You can manually serve the files from: ${INSTALL_DIR}"
        return
    fi

    if [ ! -d "$NGINX_AVAILABLE" ]; then
        print_warning "nginx sites-available directory not found, skipping configuration"
        return
    fi

    echo ""
    read -p "Would you like to configure nginx to serve Retro CNC Panel? [y/N] " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Skipping nginx configuration"
        return
    fi

    read -p "Enter port number for Retro CNC Panel [8080]: " port
    port=${port:-8080}

    print_info "Creating nginx configuration..."

    sudo tee "${NGINX_AVAILABLE}/${NGINX_CONF}" > /dev/null <<EOF
server {
    listen ${port};
    listen [::]:${port};

    root ${INSTALL_DIR};
    index index.html;

    server_name _;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    # Enable the site
    if [ ! -L "${NGINX_ENABLED}/${NGINX_CONF}" ]; then
        sudo ln -s "${NGINX_AVAILABLE}/${NGINX_CONF}" "${NGINX_ENABLED}/${NGINX_CONF}"
    fi

    # Test and reload nginx
    if sudo nginx -t; then
        sudo systemctl reload nginx
        print_success "nginx configured and reloaded"
        echo ""
        print_success "Retro CNC Panel is now available at: http://localhost:${port}"
    else
        print_error "nginx configuration test failed"
        sudo rm -f "${NGINX_AVAILABLE}/${NGINX_CONF}" "${NGINX_ENABLED}/${NGINX_CONF}"
    fi
}

print_footer() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║       INSTALLATION COMPLETE!              ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
    echo ""
    echo "Installation directory: ${INSTALL_DIR}"
    echo ""
    echo "To serve manually with Python:"
    echo "  cd ${INSTALL_DIR} && python3 -m http.server 8080"
    echo ""
    echo "To update in the future, simply run this installer again."
    echo ""
}

uninstall() {
    print_header
    print_info "Uninstalling Retro CNC Panel..."

    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
        print_success "Removed ${INSTALL_DIR}"
    fi

    # Remove nginx config if present
    if [ -f "${NGINX_AVAILABLE}/${NGINX_CONF}" ]; then
        sudo rm -f "${NGINX_ENABLED}/${NGINX_CONF}"
        sudo rm -f "${NGINX_AVAILABLE}/${NGINX_CONF}"
        sudo systemctl reload nginx 2>/dev/null || true
        print_success "Removed nginx configuration"
    fi

    # Remove backups
    for backup in "${INSTALL_DIR}.backup."*; do
        if [ -d "$backup" ]; then
            rm -rf "$backup"
            print_success "Removed backup: $backup"
        fi
    done

    print_success "Uninstallation complete"
}

main() {
    print_header

    # Check for uninstall flag
    if [ "$1" = "--uninstall" ] || [ "$1" = "-u" ]; then
        uninstall
        exit 0
    fi

    check_dependencies
    get_latest_version
    download_and_install
    setup_nginx
    print_footer
}

main "$@"
