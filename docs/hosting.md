# Hosting

The app is a static site: `vite build` writes HTML, JavaScript and CSS to `dist/`, and everything runs in the browser.
There are two ways to put it online. **GitHub Pages is set up and recommended.** The Kubernetes way is prepared for
later, e.g. if a backend is ever needed.

## 1. GitHub Pages (recommended)

The workflow `.github/workflows/deploy.yml` runs on every push to `main`: it checks everything (types, lint, tests),
builds, and publishes `dist/`.

**Once, in the repository on GitHub:**

1. _Settings → Pages → Build and deployment → Source:_ choose **GitHub Actions**.
2. Push to `main` (or _Actions → Deploy to GitHub Pages → Run workflow_).
3. The site is at `https://johannes-heissler.github.io/bestvina-handel-web/`. The first deployment takes a minute or
   two.

## 2. Your own subdomain (checkdomain + GitHub Pages)

Say the subdomain should be `bh.example.de` (replace it everywhere with yours).

**a) DNS at checkdomain**

1. Log in at checkdomain, open _Domains_, choose your domain, and open its **DNS settings** (_DNS-Einstellungen_ or
   _Nameserver/DNS_; this only works while checkdomain's nameservers are in use).
2. Add a new record:
   - **Type:** `CNAME`
   - **Name / Host:** `bh` (only the subdomain part)
   - **Value / Target:** `johannes-heissler.github.io` (some forms want a trailing dot: `johannes-heissler.github.io.`)
   - **TTL:** the default (e.g. 3600) is fine
3. Save. It can take from a few minutes up to a few hours until the record is visible (check with
   `nslookup bh.example.de`).

**b) Recommended: verify the domain at GitHub** (prevents others from using your subdomain on GitHub Pages)

1. On GitHub: your profile picture → _Settings → Pages → Add a domain_, enter `example.de`.
2. GitHub shows a **TXT** record, e.g. name `_github-pages-challenge-johannes-heissler`, with a random value. Add it at
   checkdomain like the CNAME above (type `TXT`), then click _Verify_ on GitHub.

**c) GitHub Pages settings**

1. In the repository: _Settings → Pages → Custom domain_: enter `bh.example.de` and _Save_. GitHub checks the DNS
   record, which needs the CNAME from (a).
2. Once the check passes, tick **Enforce HTTPS**. The certificate can take up to an hour.
3. The app now lives at the root of the domain, so its base path must be `/`: _Settings → Secrets and variables →
   Actions → Variables → New repository variable_: name `BASE_PATH`, value `/`.
4. Run the deployment again (_Actions → Deploy to GitHub Pages → Run workflow_).

(With deployments from GitHub Actions, no `CNAME` file is needed in the repository.)

## 3. Self-hosting on a Hetzner server with Kubernetes (optional)

Only worth it if the app ever needs a server, e.g. a shared example library. Prepared files:

- `Dockerfile`: builds the site with Node and serves it with nginx (`deploy/nginx.conf`: caching, gzip).
- `.github/workflows/container.yml`: builds the image and pushes it to the GitHub Container Registry as
  `ghcr.io/johannes-heissler/bestvina-handel-web:latest`. It runs on demand (_Actions → Container image → Run
  workflow_) and for tags `v*`.
- `deploy/k8s/app.yaml`: Deployment, Service and Ingress (nginx ingress, TLS through cert-manager).

**Steps:**

1. Build the image once (run the workflow). Then, under _your profile → Packages → bestvina-handel-web → Package
   settings_, set the visibility to **public** (or give the cluster an `imagePullSecret`).
2. The cluster needs an ingress controller and cert-manager with a `ClusterIssuer` called `letsencrypt` (e.g. the
   ingress-nginx and cert-manager Helm charts; many Hetzner k8s setups such as k3s bring Traefik instead, then change
   `ingressClassName` accordingly).
3. At checkdomain: an **A record** for `bh` with the **IP address of the server** (or of the Hetzner load balancer)
   instead of the CNAME to GitHub.
4. Replace `bh.example.org` in `deploy/k8s/app.yaml` with your subdomain, then `kubectl apply -f deploy/k8s/app.yaml`.
5. Updates: run the container workflow again, then `kubectl rollout restart deployment/bestvina-handel`.

Locally, the image can be tried with `docker build -t bh . && docker run -p 8080:80 bh` → <http://localhost:8080>.
