# The endless cut chain

*A guided tour through the 3-manifold side of the closed-surface move, with a (computer-assisted) proof that the cut
chain of the start-menu example "Point push with Dehn twists" never ends, and what a study of about 2000 examples says
about cut chains in general.*

---

## Summary

The closed-surface move (the thesis's "cutting along a singular leaf", or its shortcut "filling the puncture") replaces
the artificial puncture(s) $P$ by the orbit $Q$ of a singularity and continues the Bestvina–Handel algorithm on
$\Sigma\setminus Q$. Applied again and again, it forms a *cut chain*. For the start-menu example the chain never stops:
the number of punctures grows by $4$ with every move ($1\to2\to6\to10\to\dots$ or $1\to3\to5\to9\to\dots$), and the growth
rate falls to $1$.

**The example, in one paragraph.** The closed class $f$ is a *fractional Dehn twist* (reducible, not pseudo-Anosov), so
the chain could only stop by detecting reducibility. From the second stage on, every stage is the monodromy of a
fibration of **one and the same** hyperbolic 3-manifold, the census manifold `o10_019758`; only the fibration class
changes. In suitable coordinates $(a,b)$ on $H^1$ the stage with $P$ punctures has class $e_1+(P-6)\,e_2$, and **each
cut adds $4e_2$**. The fibred cone is $\{a>0,\ b>-6a\}$, with $e_2$ on its boundary, so the classes stay in the cone
forever and approach its boundary, where $\lambda\to1$ (Theorem 14.6). Geometrically, $e_1$ is the fibre and $e_2$ the JSJ torus
of the mapping torus of $f$: each cut adds four copies of this torus to the fibre (Proposition 14.8). §11 lists precisely how
the stages are identified with each other. All growth rates fit one polynomial,
$$G_N(x)=x^{2N+1}-x^{2N}-x^{N+3}-x^{N+2}-x^{N-1}-x^{N-2}-x+1,\qquad N=P+2.$$

**In general (§16).** In about 2000 random examples, 87% of finished chains need one cut. But long, regular chains are
common when the orbit to cut is chosen badly: some singular orbits stay uncut forever and the punctures grow by
$4+2s$ per cut, where $s$ is the index sum of these persistent singularities (Proposition 16.2). Along such a chain
$\lambda$ decreases to a limit that equals the growth of the closed class: $1$, the growth of a pseudo-Anosov piece, or
$\lambda(f)$ itself when $f$ is pseudo-Anosov (Lemma 16.3 explains the inequality). The orbit choice decides
everything: cutting the persistent small orbit (the app's default, smallest period first) ended every escapable chain
after one cut, while the largest period never ended. Chains that are *forced* (one orbit at every step) were all found in
the family $G_N$ above, realised by six different words.

**How to read.** Part I explains the notions needed, with definitions, examples and references. Part II states what is
proved, what is computed, and how the pieces fit together. Each claim is marked: **Definition**, **Theorem/Lemma/
Proposition** (proved here or in the literature), **Computation** (done by the programs in `scripts/cut-study`),
**Conjecture**.

---

# Part I — Background

## 1. Mapping tori and suspension flows

**Definition 1.1.** Let $S$ be a surface (possibly with punctures) and $\varphi\colon S\to S$ a homeomorphism. The
*mapping torus* is
$$M_\varphi = S\times[0,1]\,/\,(x,1)\sim(\varphi(x),0).$$
The projection $(x,s)\mapsto s$ gives a fibration $M_\varphi\to S^1=[0,1]/0\sim1$ with fibre $S$. The flow
$\psi_t(x,s)=(x,s+t)$, continued through the gluing, is the *suspension flow*. Starting on the fibre $S\times\{0\}$, a
point $(x,0)$ flows to $(x,1)\sim(\varphi(x),0)$: the *first-return map* to the fibre is $\varphi$.

- **Periodic orbits are closed orbits.** A periodic orbit $x,\varphi(x),\dots,\varphi^{n-1}(x)$ of period $n$ is the trace on
  the fibre of one closed orbit of the flow, which crosses the fibre $n$ times. Conversely every closed orbit arises so.
- **Conjugacy.** If $\varphi'=h\varphi h^{-1}$, then $(x,s)\mapsto(h(x),s)$ is a homeomorphism $M_\varphi\to M_{\varphi'}$. If $\varphi'$ is
  isotopic to $\varphi$, the isotopy gives a homeomorphism as well (Lemma 1.3). So $M_\varphi$ depends only on the conjugacy
  class of the *mapping class* of $\varphi$; and $M_{\varphi^{-1}}\cong M_\varphi$ with the opposite orientation.
- **Punctures** become cusps: a puncture orbit of period $n$ is a closed curve missing from $M_\varphi$; in the compact model,
  a torus boundary component.

*Examples.* $\varphi=\mathrm{id}$ gives $S\times S^1$. For the once-punctured torus and the Anosov map
$\begin{pmatrix}2&1\\1&1\end{pmatrix}$ one gets the complement of the figure-eight knot (SnapPy: `m004`).

**Lemma 1.2 (homology of a mapping torus).** $H_1(M_\varphi;\mathbb Z)\cong \mathbb Z\oplus H_1(S;\mathbb Z)_\varphi$, where
$H_1(S)_\varphi=H_1(S)/\operatorname{im}(\varphi_*-1)$ are the *coinvariants*. In particular
$b_1(M_\varphi)=1+\dim\ker(\varphi_*-1)$ on $H_1(S;\mathbb Q)$.

*Proof.* Cut $M_\varphi$ along the fibre $S\times\{0\}$: what is left is $S\times(0,1)$. The Mayer–Vietoris sequence of this
decomposition (the *Wang sequence*) reads
$$H_1(S)\xrightarrow{\ \varphi_*-1\ }H_1(S)\to H_1(M_\varphi)\to H_0(S)\xrightarrow{\ 0\ }H_0(S).$$
Here a loop in $S$ is compared with its image after going once around the circle, which gives $\varphi_*-1$. The image of
$H_1(S)$ in $H_1(M_\varphi)$ is the cokernel of $\varphi_*-1$; the remaining $\mathbb Z$ is generated by a loop that goes once around
the circle, and it splits off because it maps onto $H_0(S)\cong\mathbb Z$. Over $\mathbb Q$, the cokernel of $\varphi_*-1$ has the same
dimension as its kernel. $\square$

*Example.* For a Dehn twist $T_c$ on a closed surface of genus $g$, $T_{c*}-1$ is $x\mapsto (x\cdot c)\,c$, of rank 1, so
$b_1(M_{T_c})=1+(2g-1)=2g$. For our closed class $f$ (§11), $\operatorname{rank}(f_*-1)=3$ on $H_1(\Sigma)\cong\mathbb Z^4$, so
$b_1(M_f)=2$.

**Lemma 1.3 (isotopic monodromies: a canonical identification).** Let $\Sigma$ be a closed surface of genus $\ge2$ and
$\varphi\simeq\varphi'$ isotopic homeomorphisms. An isotopy defines a homeomorphism $\Psi\colon M_\varphi\to M_{\varphi'}$ that maps the fibre
$\Sigma\times\{0\}$ to the fibre, so $\Psi^*[\Sigma]=[\Sigma]$. **Any two homeomorphisms obtained like this are isotopic.** If $Q$ is a
finite set with $\varphi(Q)=\varphi'(Q)=Q$, $\varphi|_Q=\varphi'|_Q$, and the isotopy is rel $Q$, then $\Psi$ maps the suspension of $Q$ in
$M_\varphi$ onto the suspension of $Q$ in $M_{\varphi'}$.

*Proof.* Put $\Psi(x,s)=(k_s(x),s)$ for a path $k_s$ of homeomorphisms. It respects the gluings $(x,1)\sim(\varphi(x),0)$ and
$(y,1)\sim(\varphi'(y),0)$ exactly when $\varphi'\circ k_1=k_0\circ\varphi$. Take $k_0=\mathrm{id}$ and $k_1=\varphi'^{-1}\varphi$, which is isotopic to
the identity; any isotopy $k_s$ from $\mathrm{id}$ to $\varphi'^{-1}\varphi$ works. Two such paths differ by a loop in
$\operatorname{Homeo}_0(\Sigma)$, the identity component. For genus $\ge2$ this group is **contractible** (Hamstrom; Earle–Eells for
diffeomorphisms), so the two paths are homotopic rel endpoints, and the homotopy is an isotopy between the two $\Psi$. For the
relative version use paths in $\operatorname{Homeo}_0(\Sigma,Q)$, the homeomorphisms fixing $Q$ pointwise and isotopic to $\mathrm{id}$ rel $Q$;
it is again contractible ($\Sigma\setminus Q$ is hyperbolic). Then $k_s(q)=q$ for $q\in Q$, and $\Psi(q,s)=(q,s)$: the suspension of
$Q$ is mapped to itself. $\square$

*Why contractibility matters.* Without it, a non-trivial loop of homeomorphisms could twist $M_\varphi$ around the circle
direction, and the identification would depend on the isotopy chosen. For the torus ($\operatorname{Homeo}_0(T^2)\simeq T^2$) this
really happens. In genus $\ge2$ the identification $M_\varphi\cong M_{\varphi'}$ is canonical up to isotopy, and so is every curve
defined through it.

## 2. The geometry of mapping tori

**Thurston's geometrisation** says that a compact orientable 3-manifold (with torus boundary) can be cut along
finitely many spheres and tori into pieces that each carry one of eight homogeneous geometries. For mapping tori of a
hyperbolic surface $S$ ($\chi(S)<0$) everything is explicit and matches the Nielsen–Thurston type of $\varphi$:

| type of $\varphi$ | $M_\varphi$ | geometry |
|---|---|---|
| periodic (finite order) | Seifert fibred: the flow lines close up into circles | $\mathbb H^2\times\mathbb R$ |
| pseudo-Anosov | hyperbolic (finite volume; cusps for the punctures) | $\mathbb H^3$ |
| reducible | cut along tori into pieces of the two kinds above | none globally: *mixed* or *graph manifold* |

**Definitions.**
- A *Seifert fibred space* is a 3-manifold that is a union of disjoint circles (*fibres*), each with a neighbourhood that is
  a standard fibred solid torus. Example: $S\times S^1$.
- A torus $T\subset M$ is *incompressible* if no essential curve on $T$ bounds a disc in $M$; it is *essential* if moreover
  it is not parallel to a boundary torus. The **JSJ decomposition** (Jaco–Shalen, Johannson) is the minimal family of
  essential tori that cuts $M$ into Seifert fibred and atoroidal pieces; it is unique up to isotopy.
- A *graph manifold* is one whose JSJ pieces are all Seifert fibred.

**Why the table holds.**
- *Periodic.* If $\varphi^n=\mathrm{id}$, every flow line closes up after time $n$ (or a divisor of $n$ for the finitely many
  points with shorter period): the flow lines are the Seifert fibres.
- *Reducing curves give tori.* If $\varphi(c)=c$ for a simple closed curve $c$ (after isotopy), the suspension of $c$ is a torus
  $T_c\subset M_\varphi$ (a Klein bottle if $\varphi$ reverses $c$; then take the boundary of its neighbourhood). It is
  incompressible: a compressing disc would project to a null-homotopy of a power of $c$ in $S$ (or of a curve that is
  homotopic into the fibre direction), impossible for an essential $c$.
- *Hyperbolic manifolds have no essential tori*: the fundamental group of a torus is $\mathbb Z^2$, and in a hyperbolic manifold
  every $\mathbb Z^2$ subgroup is peripheral (it comes from a cusp). So $\varphi$ pseudo-Anosov is necessary for hyperbolicity.
- *Thurston's hyperbolisation theorem for fibred 3-manifolds* (see Otal's book) gives the converse: if $\varphi$ is
  pseudo-Anosov, $M_\varphi$ is hyperbolic.
- *Reducible.* The canonical reduction system $\mathcal C$ suspends to the JSJ tori (orbit by orbit). Cutting along them
  leaves the mapping tori of the first-return maps on the pieces of $S\setminus\mathcal C$: Seifert fibred for periodic pieces,
  hyperbolic for pseudo-Anosov pieces. If all pieces are periodic, $M_\varphi$ is a graph manifold.

*Examples.* For torus bundles the same trichotomy reads: finite order (Euclidean geometry), reducible = a power of a Dehn
twist (Nil geometry), Anosov (Sol geometry). For a hyperbolic surface, a Dehn twist $T_c$ gives a graph manifold:
$(S\setminus c)\times S^1$ glued to itself along the torus over $c$ with a shear. Our $f$ is periodic on $\Sigma\setminus\delta$
and twists along $\delta$ (§11), so $M_f$ is a graph manifold with one JSJ torus $T_\delta$, the suspension of $\delta$.

**Rigidity: how many homeomorphisms there are.** Hyperbolic 3-manifolds have very few self-homeomorphisms, and this is
what makes identifications between them essentially unique.

**Theorem 2.1 (Mostow 1968, Prasad 1973).** Let $M,M'$ be complete hyperbolic manifolds of **finite volume** and dimension
$n\ge3$. Every isomorphism $\pi_1(M)\to\pi_1(M')$ is induced by a unique isometry $M\to M'$.

**Theorem 2.2 (Waldhausen 1968).** Two homeomorphisms between compact irreducible Haken 3-manifolds (for example fibred ones)
that are homotopic are isotopic.

**Corollary 2.3.** For a hyperbolic 3-manifold $M$ of finite volume, every homeomorphism $M\to M'$ is isotopic to exactly one
isometry, and the mapping class group $\operatorname{Mod}(M)$ is the isometry group: a **finite** group.

*Proof.* A homeomorphism $g$ induces an isomorphism on $\pi_1$ (up to conjugation, i.e. an element of $\operatorname{Out}$), and by
Theorem 2.1 an isometry $g'$ induces the same one. $M$ is aspherical (its universal cover is $\mathbb H^3$), so maps that agree on
$\pi_1$ up to conjugation are homotopic, and by Theorem 2.2 $g\simeq g'$ by an isotopy. Two isometries that are isotopic induce the
same element of $\operatorname{Out}(\pi_1)$, hence are equal by the uniqueness in Theorem 2.1. The isometry group of a finite-volume
hyperbolic manifold is a discrete group acting on a set of finite volume, hence finite. $\square$

*Where the hypotheses matter.*
- **Dimension $n\ge3$.** For $n=2$ the theorem is false: a hyperbolic surface has a whole Teichmüller space of hyperbolic
  structures, and its mapping class group is infinite. This is the only reason; "closed" is **not** needed.
- **Finite volume** is needed, but cusps are allowed (Prasad's extension). All drilled manifolds in Part II are cusped and of
  finite volume. For the compact model with torus boundary, homeomorphisms may move the boundary tori; they correspond to
  homeomorphisms of the interior, so the corollary applies.
- **Consistency check with the fibre.** For pseudo-Anosov $\varphi$ on $S$, $\operatorname{Mod}(S)$ is infinite but $\operatorname{Mod}(M_\varphi)$ is
  finite. No contradiction: a mapping class $c$ of $S$ gives a homeomorphism $(x,s)\mapsto(c(x),s)$ of $M_\varphi$ only if
  $c\varphi c^{-1}=\varphi$, and the centraliser of a pseudo-Anosov is virtually cyclic, generated up to finite index by $\varphi$
  itself. And $\varphi$ induces on $M_\varphi$ the time-1 map of the suspension flow, $(x,s)\mapsto(\varphi(x),s)\sim(x,s+1)$, which is
  isotopic to the identity (flow back for time $t\in[0,1]$).
- **Non-hyperbolic manifolds** can have infinite mapping class groups. For $M_f$ (a graph manifold) this happens: a *torus
  twist* along $T_\delta$ (§14, Proposition 14.8) has infinite order. Rigidity therefore applies to the drilled manifolds of the
  chain, not to $M_f$ itself.

References: P. Scott, *The geometries of 3-manifolds*; W. Thurston, *Hyperbolic structures on 3-manifolds II*;
J.-P. Otal, *The hyperbolization theorem for fibered 3-manifolds*.

## 3. Cohomology classes, fibred classes, and the pairing $\langle\alpha,c\rangle$

Let $M$ be a compact orientable 3-manifold (the cusps of a hyperbolic manifold are torus boundary components).

- **Three views of a class.** $H^1(M;\mathbb Z)=\operatorname{Hom}(H_1(M),\mathbb Z)=[M,S^1]$: a class is a homomorphism from loops to
  integers, or a map to the circle up to homotopy (pull back the angle form).
- **Duality.** Every $\alpha\in H^1(M;\mathbb Z)$ is *dual* to a properly embedded oriented surface $S_\alpha$ (the preimage of a
  regular value of a map $M\to S^1$ representing $\alpha$). For a closed oriented curve $c$ transverse to $S_\alpha$,
  $$\langle\alpha,c\rangle := \alpha([c]) = \#\{\text{positive crossings of }S_\alpha\} - \#\{\text{negative crossings}\}.$$
  This is the *Kronecker pairing*. It depends only on the homology class of $c$ and the cohomology class $\alpha$.
- **Fibred classes.** $\alpha$ is *fibred* if it is represented by a fibration $M\to S^1$; then $S_\alpha$ is a fibre and $M$ is
  the mapping torus of the first-return map $\varphi_\alpha$ (the *monodromy*). If $b_1(M)\ge2$, a fibred manifold fibres in
  infinitely many ways, with fibres of different topology (§4).
- **Closed orbits.** If $c$ is a closed orbit of the suspension flow of $\varphi_\alpha$, then $c$ crosses each fibre positively,
  and $\langle\alpha,c\rangle$ is the number of points of $c$ on one fibre, i.e. the **period** of the corresponding periodic
  orbit of $\varphi_\alpha$. The first-return map permutes these points **cyclically** (they are the successive crossings of
  one closed curve).

*Example.* In the cut chain, $\gamma$ is the suspension of the puncture orbit $P$ and $\sigma$ the suspension of the singular
orbit $Q$. For the fibre class $\alpha=[\Sigma]$: $\langle\alpha,\gamma\rangle=|P|$ and $\langle\alpha,\sigma\rangle=|Q|$.

## 4. The Thurston norm and fibred faces

For a compact surface $S$ with components $S_i$ put $\chi_-(S)=\sum_i\max(0,-\chi(S_i))$ (spheres and discs do not count).

**Definition 4.1 (Thurston).** For integral $\alpha$, $x(\alpha)=\min\{\chi_-(S): S \text{ properly embedded, dual to }\alpha\}$.

**Theorem 4.2 (Thurston, *A norm for the homology of 3-manifolds*).**
1. $x$ extends to a seminorm on $H^1(M;\mathbb R)$, a norm if $M$ is hyperbolic.
2. Its unit ball $B_x=\{x\le1\}$ is a convex polyhedron, defined by finitely many inequalities $|\langle\beta_i,\cdot\rangle|\le1$
   with integral $\beta_i\in H_1(M;\mathbb Z)$.
3. Fibres are norm-minimising: if $\alpha$ is fibred with fibre $S$, then $x(\alpha)=-\chi(S)$.
4. **Fibred faces.** If $\alpha$ is fibred, let $F$ be the top-dimensional open face of $\partial B_x$ that contains
   $\alpha/x(\alpha)$ (it lies in the interior of a face, never on a lower-dimensional one). Then **every** integral class in the
   open cone $\mathbb R_{>0}F$ is fibred. Such $F$ is a *fibred face*.

*Why these hold, roughly.*
- (1) *Subadditivity* $x(\alpha+\beta)\le x(\alpha)+x(\beta)$: put dual surfaces of $\alpha$ and $\beta$ in general position and
  resolve the double curves by cutting and regluing (the *double curve sum*). This gives a surface dual to $\alpha+\beta$
  with the same $\chi_-$. Homogeneity $x(n\alpha)=n\,x(\alpha)$ needs more care.
- (2) The integrality comes from the fact that $x$ takes integer values on the lattice; a convex function with this property
  and the right homogeneity is piecewise linear with integral "slopes".
- (4) A fibre can be pushed slightly to be transverse to the flow; surfaces for nearby classes can be built from the fibre and
  surfaces transverse to the flow (Fried's viewpoint, §5), and remain fibres.

**Consequences used below.**
- On the cone $\mathbb R_{>0}F$ over a face, $x$ is **linear**: $x(\alpha)=\langle\beta_F,\alpha\rangle$ for one fixed $\beta_F$. (For a
  fibred face, $-\beta_F$ is the Euler class of the tangent plane field of the fibres.)
- Fibred classes lie in *open* cones: a fibred class is never on the boundary between two faces, and the boundary classes of a
  fibred cone are never fibred within that face.

*Example.* If $b_1(M)=1$, then $H^1=\mathbb R$ and the only fibred classes are $\pm$ the fibre class. In our example $b_1=2$: the unit
ball is a polygon in the plane, a fibred face is an edge of it, and its cone is an open sector bounded by two rays through
vertices of the polygon.

## 5. Fried's theory: one flow per face

This section explains why all fibrations in one fibred face are "the same dynamics seen from different angles". It is what
lets us treat all stages of the chain at once.

**Definition 5.1 (cross-section).** Let $\psi$ be a flow on $M$. A *cross-section* is a compact surface $S\subset M$ (with boundary
on $\partial M$) that is transverse to $\psi$ and meets every flow line, again and again in both time directions. The
first-return map $S\to S$ is then a homeomorphism, and $M$ is its mapping torus. A cross-section is dual to a class
$\alpha=[S]$, and $\alpha>0$ on every closed orbit.

**Definition 5.2 (homology directions).** For a flow $\psi$, take long orbit segments $\psi_{[0,T]}(x)$, close them up by a short
arc, and normalise the homology class by $1/T$. The limits of these classes as $T\to\infty$ form a closed cone
$D_\psi\subset H_1(M;\mathbb R)$, the *cone of homology directions*. For the suspension flow of a pseudo-Anosov map, $D_\psi$ is
the closed cone generated by the classes of the closed orbits (closed orbits are dense enough to approximate every long
segment, by the Markov partition).

**Theorem 5.3 (Fried 1982).** A class $\alpha\in H^1(M;\mathbb Z)$ is dual to a cross-section of $\psi$ if and only if $\alpha>0$ on
$D_\psi\setminus\{0\}$.

*Idea.* "Only if" is clear: a cross-section crosses every long orbit segment about $T\cdot\alpha(\text{direction})$ times, and
this must be positive. For "if", one averages a closed 1-form representing $\alpha$ along the flow until it is positive on the
flow direction; then its level sets are cross-sections.

**Theorem 5.4 (one flow per face; Thurston, Fried).** Let $F$ be a fibred face of a hyperbolic $M$ and $\alpha_0$ a fibred class in
its cone, with pseudo-Anosov monodromy $\varphi_0$ and suspension flow $\psi_F$. Then
$$\mathbb R_{>0}F=\{\alpha:\ \alpha>0 \text{ on } D_{\psi_F}\setminus0\},$$
so every fibre of every class in the cone of $F$ is (isotopic to) a cross-section of the **same** flow $\psi_F$, and its
monodromy is the first-return map, again pseudo-Anosov.

*Why it is plausible.* The suspension flow of a pseudo-Anosov is "pseudo-Anosov" itself: it contracts and expands along two
transverse singular foliations of $M$ (the suspensions of the stable and unstable foliations). Any surface transverse to
this flow inherits the two foliations, and the first-return map stretches one and contracts the other: it is
pseudo-Anosov. The set of classes positive on $D_\psi$ is an open convex cone (Theorem 5.3); Thurston's norm is linear on it
(the Euler class of the plane field orthogonal to the flow), so it is the cone over one face.

**Consequences, used in Part II.**
1. **Singular orbits belong to the face.** The singular closed orbits of $\psi_F$ (the suspensions of the singularities of
   $\varphi_0$) do not depend on the class: for every $\alpha$ in the cone, the singularities of $\varphi_\alpha$ are exactly the points
   where the fibre meets these orbits. A singular orbit $c$ with $k$ prongs gives one cyclic orbit of $\varphi_\alpha$ of length
   $\langle\alpha,c\rangle$, all of whose points are $k$-prongs. In particular, *if the flow has one singular orbit, every
   monodromy in the face has one orbit of singularities.*
2. **Cusps belong to the face.** Near a cusp (a puncture orbit) the flow looks the same for all classes; the number of prongs
   at the punctures is read off from the fibre's boundary slope (Lemma 14.4).
3. **Entropy.** Let $h(\alpha)=\log\lambda(\varphi_\alpha)$. Then $h$ extends to a continuous function on the open cone,
   homogeneous of degree $-1$ ($h(t\alpha)=h(\alpha)/t$), with $1/h$ concave (McMullen: strictly concave), and
   **$h(\alpha)\to\infty$ as $\alpha$ approaches the boundary of the cone.**

*Why $h$ behaves like this (Abramov's formula).* The flow $\psi_F$ has a fixed entropy; a first-return map to a cross-section
has entropy equal to the flow's entropy times the average return time. Scaling $\alpha$ by $t$ divides the return time by $t$,
hence degree $-1$. Near the boundary of the cone, $\alpha$ is almost $0$ on some homology directions: the fibre is almost
parallel to some long orbits, return times along them become huge, and the entropy of the first-return map blows up.

So the *normalised entropy* $x(\alpha)\,h(\alpha)=|\chi(S_\alpha)|\log\lambda$ is bounded on compact parts of the face but tends to
infinity towards its boundary. In the cut chain, $|\chi|\log\lambda$ grows like $\log N$ (§16): the classes run to the boundary.

**What "the same flow" means.** Theorem 5.4 is used in two different senses, and it helps to separate them.

1. *Literally the same.* Fix one flow $\psi_F$ on $M$. Then, for every class $\alpha$ in the cone, the fibre $S_\alpha$ is chosen
   as a cross-section of **this** flow, and $\varphi_\alpha$ is its first-return map. The closed orbits, in particular the
   singular ones, are then literally the same curves in $M$ for all $\alpha$; only the surface cutting through them changes.
   Consequence 1 above is meant in this sense.
2. *The same up to isotopy.* A pseudo-Anosov built independently (for example the output of the Bestvina–Handel algorithm
   for one class) has its own suspension flow. It is not literally $\psi_F$, but it agrees with it up to an isotopy of $M$:

**Lemma 5.5 (uniqueness of the face flow).** Let $\alpha$ be in the cone of the fibred face $F$, and let $M\to S^1$ be any fibration
in the class $\alpha$ whose monodromy $\varphi'$ is pseudo-Anosov, with suspension flow $\psi'$. Then there is a homeomorphism
$\Phi\colon M\to M$, **isotopic to the identity**, that maps the orbits of $\psi'$ onto the orbits of $\psi_F$, preserving their
direction (an *orbit equivalence*; the speed may change).

*Proof.* (a) *The fibres agree up to isotopy.* Two fibrations of $M$ in the same cohomology class are isotopic
(Laudenbach–Blank for closed $M$; for torus boundary, Thurston's norm paper: a fibre is the only norm-minimising surface in its
class, up to isotopy). So after an isotopy of $M$ the fibre $S'$ of $\varphi'$ is the cross-section $S_\alpha$ of $\psi_F$. (b) *The
monodromies agree up to conjugation.* The monodromy of a fibration is determined by the fibration up to isotopy, so $\varphi'$
and the first-return map $\varphi_\alpha$ are isotopic homeomorphisms of $S_\alpha$, and both are pseudo-Anosov. A pseudo-Anosov
representative is unique in its isotopy class up to conjugation by a homeomorphism isotopic to the identity (FLP,
Exposé 12): $\varphi'=c\,\varphi_\alpha c^{-1}$ with $c\simeq\mathrm{id}$. (c) *The flows agree.* The map $(x,s)\mapsto(c(x),s)$ takes the
suspension flow of $\varphi_\alpha$, which is $\psi_F$ up to speed, to that of $\varphi'$; with (a) and the construction of Lemma 1.3 this is
a homeomorphism of $M$ isotopic to the identity. $\square$

*What survives an isotopy of $M$, and what does not.* Isotopic flows have isotopic closed orbits, so "the singular orbit $\sigma$"
is a knot in $M$ that is well defined **up to isotopy**. The complement $M\setminus\sigma$ is then well defined up to a homeomorphism
that extends to a homeomorphism of $M$ isotopic to the identity. Such a homeomorphism acts as the identity on $H^1(M)$, so it
acts as the identity on $H^1(M\setminus\sigma)$ under the restriction isomorphism of Lemma 9.1. It is **not** unique up to isotopy
of $M\setminus\sigma$: two choices differ by a homeomorphism of $M$ that maps $\sigma$ to itself and is isotopic to the identity in $M$,
but possibly not rel $\sigma$ (it could drag $\sigma$ once around a loop). For classes, the only thing used in Part II, this
ambiguity is invisible.

References: D. Fried, *The geometry of cross sections to flows* (Topology 1982); C. McMullen, §6 below.

## 6. McMullen's Teichmüller polynomial

**What we need it for.** *Nothing in the proof of non-termination (Theorem 14.6) uses it.* It enters in two places only:
- **As a hypothesis generator.** That one polynomial in two variables reproduces all growth rates of the chain was the first
  sign that all stages are fibrations of one manifold in one face; the veering triangulations then proved this.
- **For the λ-formula.** To prove that the stage with $P$ punctures has $\lambda=$ largest root of $G_{P+2}$ for **all** $P$
  (Conjecture 16.6), one would compute the polynomial of the face once.

**Theorem 6.1 (McMullen 2000).** Let $F$ be a fibred face of $M$, and $G=H_1(M;\mathbb Z)/\text{torsion}$, written
multiplicatively. There is an element $\Theta_F\in\mathbb Z[G]$, a Laurent polynomial in $b_1(M)$ variables, well defined up to
multiplication by $\pm g$, such that for every integral $\alpha$ in the cone over $F$ the dilatation $\lambda(\varphi_\alpha)$ is the
**largest root** of the one-variable *specialisation*
$$\Theta_F^\alpha(z)=\sum_{g\in G}a_g\, z^{\alpha(g)}\qquad\text{where }\Theta_F=\sum_g a_g\,g.$$
(Each monomial $g$ is replaced by $z$ raised to the value of $\alpha$ on it.)

**How it is built (one fibre is enough).** Fix one fibred class $\alpha_0$ in the face, with fibre $S$, pseudo-Anosov $\varphi_0$ and
an invariant train track $\tau$ with train-track map $g_\tau$.
1. Let $H=\operatorname{im}(H_1(S)\to G)$, the part of the homology seen inside the fibre. Choose $u\in G$ with $\alpha_0(u)=1$ (one turn
   around the circle); then $G\cong H\times\langle u\rangle$ for the purposes of the polynomial.
2. Lift $\tau$ to the cover $\tilde S\to S$ with deck group $H$, and lift $g_\tau$. A branch of $\tau$ has an $H$-orbit of lifts; the
   image of a lifted branch crosses lifts $h\cdot e'$ of other branches. Recording these $h\in H$ turns the transition matrix
   into a matrix $P_E(t)$ with entries in $\mathbb Z[H]$ (the "twisted transition matrix"); likewise $P_V(t)$ for the switches.
3. McMullen proves
   $$\Theta_F=\frac{\det\bigl(u\,I-P_E(t)\bigr)}{\det\bigl(u\,I-P_V(t)\bigr)}.$$

**Why the largest root is $\lambda$ (worked case $\alpha=\alpha_0$).** For $\alpha_0$ itself, every $h\in H$ has $\alpha_0(h)=0$ (it lives in the
fibre) and $\alpha_0(u)=1$. So the specialisation replaces all $t\mapsto1$ and $u\mapsto z$:
$$\Theta_F^{\alpha_0}(z)=\frac{\det(zI-P_E(1))}{\det(zI-P_V(1))}=\frac{\text{char. polynomial of the transition matrix}}{\text{char. polynomial of the switch permutation}}.$$
The largest root of the numerator is the Perron–Frobenius eigenvalue $\lambda(\varphi_0)$; the denominator only has roots of unity.
For other classes $\alpha$ the substitution weights each crossing of the fibre's homology by $z^{\alpha(h)}$; this is the
transition matrix of the first-return map to the *new* fibre, written in the old coordinates, and its Perron–Frobenius
root is $\lambda(\varphi_\alpha)$.

**What we observe.** For every stage of the chain, the characteristic polynomial of the transition matrix is
$(x+1)\,G_{P+2}(x)$ (for minimal train tracks; Computation 12.2), and $G_N(x)=\Theta(x,x^N)$ for
$$\Theta(x,t)=(x-1)(t^2-1)-t\,(x^3+x^2+x^{-1}+x^{-2}).$$
This is exactly the shape of a Teichmüller polynomial specialised along a line of classes $\alpha$ with $\alpha(X)=1$, $\alpha(T)=N$.
It is symmetric, $\Theta(x^{-1},t^{-1})=x^{-1}t^{-2}\,\Theta(x,t)$, as McMullen's polynomial must be.

**How to compute it rigorously.** Landry–Minsky–Taylor define the *taut polynomial* of a veering triangulation (from a
presentation of the module generated by the edges, with one relation per tetrahedron, over $\mathbb Z[G]$), and prove it equals
$\Theta_F$ when the triangulation is layered. Parlak gives an algorithm. With our veering triangulation $V$ (§15) this is a
finite computation; it would turn Conjecture 16.6 into a theorem.

*Example.* For a once-punctured torus bundle with Anosov monodromy $A$ ($b_1=1$, $H=0$): $\Theta(u)=u^2-\operatorname{tr}(A)u+1$; for
`m004`, $u^2-3u+1$ with $\lambda=\varphi^2$, $\varphi$ the golden ratio.

## 7. Prongs, cusps and the index formula

A singular measured foliation on a surface has finitely many singular points, each a $k$-*prong*: $k$ leaves meet there,
like the $k$ separatrices of a monkey saddle. In the interior $k\ge3$; at a puncture $k\ge1$ is allowed, and a 2-prong is a
regular point.

**In train-track terms.** The complementary regions of the invariant train track are polygons (around singularities) and
once-punctured polygons (around punctures). A $k$-gon gives a $k$-prong; $k$ is the number of **cusps** of the region. "One cusp
at the puncture" means a 1-prong: a puncture that cannot be filled in without destroying the foliation.

**Theorem 7.1 (Euler–Poincaré formula).** If $\bar S$ is the closed surface obtained by filling the punctures, and $s$ runs over
the singularities and punctures with $k_s$ prongs, then
$$\sum_s\Bigl(1-\frac{k_s}{2}\Bigr)=\chi(\bar S).$$

*Proof sketch.* If all $k_s$ are even, the foliation is orientable after choosing directions, and its tangent line field is a
vector field with zeros of index $1-k_s/2$ at the singularities; Poincaré–Hopf gives the formula. In general pass to the
double cover branched at the odd-prong points, where the foliation becomes orientable, and divide by 2 (Farb–Margalit,
*Primer*, Prop. 11.4). $\square$

*Examples (genus 2, $\chi=-2$).* One 6-prong; two 4-prongs; one 4-prong and two 3-prongs; four 3-prongs. With punctures: one
1-prong and five 3-prongs ($\tfrac12-\tfrac52=-2$), which is the start of our chain.

**Corollary 7.2.** If all singularities are 3-prongs and all punctures 1-prongs, then $n_3=n_1+4g-4$; in genus 2, $n_3=n_1+4$.

*Proof.* $\tfrac12 n_1-\tfrac12 n_3=2-2g$. $\square$

**Flow version.** By §5, in a fibred face with puncture orbit $\gamma$ (1-prongs) and singular orbits $\sigma_i$ ($k_i$ prongs), the
formula on the fibre of $\alpha$ reads $\tfrac12\langle\alpha,\gamma\rangle+\sum_i(1-\tfrac{k_i}2)\langle\alpha,\sigma_i\rangle=2-2g$, where $g$ is the genus of the
filled fibre. With one singular orbit of 3-prongs: $\langle\alpha,\sigma\rangle-\langle\alpha,\gamma\rangle=4g-4$ for every $\alpha$ in the face.

## 8. Point pushes and the Birman exact sequence

For a closed surface $\Sigma$ of genus $\ge2$ and a point $p$ there is an exact sequence
$$1\to\pi_1(\Sigma,p)\xrightarrow{\ \mathrm{Push}\ }\operatorname{Mod}(\Sigma\setminus p)\xrightarrow{\ \mathrm{Forget}\ }\operatorname{Mod}(\Sigma)\to1.$$
- **Push.** For a loop $c$ at $p$, drag $p$ once around $c$ by an isotopy of $\Sigma$ supported near $c$; the end map fixes $p$ and
  is $\mathrm{Push}(c)$. If $c$ is simple, $\mathrm{Push}(c)=T_{c_1}T_{c_2}^{-1}$ for the two boundary curves $c_1,c_2$ of a
  neighbourhood of $c$.
- **Forget.** As a map of $\Sigma$ (forgetting $p$), $\mathrm{Push}(c)$ is isotopic to the identity (undo the dragging). So
  $\mathrm{Forget}\circ\mathrm{Push}=1$, and the theorem says that every class acting trivially on $\Sigma$ is a push.
- **Consequence.** A word in pushes and Dehn twists on $\Sigma\setminus p$ has the closed class of its twists alone, in the same
  order. This is why we use the *twist-only word* as a reference for the closed class (§16).
- **Kra's theorem.** $\mathrm{Push}(c)$ is pseudo-Anosov iff $c$ fills $\Sigma$ (every essential curve meets it). In 3-manifold terms
  $M_{\mathrm{Push}(c)}=\Sigma\times S^1\setminus\tilde c$ for a curve $\tilde c$ that projects to $c$, and it is hyperbolic iff $c$ fills.

Reference: Farb–Margalit, *Primer*, §4.2 and §14.1.

## 9. Dehn filling, meridians and rational longitudes

Removing an open tubular neighbourhood $N(\gamma)$ of a knot $\gamma\subset X$ gives $E=X\setminus N(\gamma)$ with a torus boundary
component $T$. (In Part II, $\dot M_k$ is the open manifold with cusps and $E$ its compact version. The interior of $E$ is $\dot M_k$,
and $E$ is a deformation retract of it, so the two have the same homology and, up to isotopy, the same homeomorphisms.)

**Meridian and longitude.** Think of $N(\gamma)$ as a solid torus $D^2\times S^1$ with core $\gamma=\{0\}\times S^1$, and of $T$ as its
boundary $\partial D^2\times S^1$.
- The **meridian** $\mu=\partial D^2\times\{pt\}$ is a small circle *around* the knot. It bounds a disc in $N(\gamma)$; when the solid
  torus is retracted onto its core, $\mu$ goes to a point. It is unique up to isotopy on $T$ (and orientation).
- A **longitude** $\ell$ is a curve on $T$ that runs once *along* the knot, parallel to it; under the retraction it goes once
  around $\gamma$. It is **not** unique: any curve on $T$ that meets $\mu$ exactly once is a longitude, so $\ell+k\mu$ (winding $k$
  times around the knot while going once along it) is one too. For knots in $S^3$ there is a preferred one, the *Seifert
  longitude*, which bounds a surface in $E$; in general there is none, and nothing below depends on the choice.

A *slope* is an isotopy class of essential simple closed curves on $T$ (up to orientation), written $p\mu+q\ell$ in such a basis.
Gluing a solid torus back so that a slope $s$ bounds the disc is *Dehn filling* along $s$; filling along the meridian gives
back $X$, other slopes give (usually) different manifolds.

**Rational longitude.** The *rational longitude* of $T$ is the slope that is zero in $H_1(E;\mathbb Q)$, i.e. torsion in $H_1(E;\mathbb Z)$;
when $E$ has a single boundary torus, it always exists and is unique ("half lives, half dies"). With several boundary
tori this can fail for an individual torus, which is what Lemma 9.1 below is about. **Beware of the names:**
"meridian" describes a curve by the solid torus (it bounds a disc there), "rational longitude" by $E$ (it dies in $H_1(E)$).
For a knot in $S^3$ the rational longitude is the Seifert longitude, so the names agree. In our situation it is the
**meridian** (Lemma 9.1), which is why the lemma is called "rational longitudes" while being about meridians.

*What "torsion" means geometrically.* $n\mu=0$ in $H_1(E;\mathbb Z)$ means: there is an oriented surface in $E$ whose oriented
boundary consists of $n$ parallel copies of $\mu$, **all oriented the same way** (in 3-manifolds such a surface can be chosen
embedded). An annulus between two parallel copies does not count: its boundary, with the induced orientation, is $\mu-\mu'$, one
copy against the other. That only says $[\mu]=[\mu']$ (parallel curves are homologous), not $2\mu=0$. In $M_k=M_f\setminus N(\gamma_k)$ the
surface is the fibre: it meets $\gamma$ in $n$ points, all crossings positive, and cutting out a small disc around each one leaves
a surface whose boundary is $n$ meridian circles, all oriented the same way.

The point of this section: if we are only given the drilled manifold $E$ (for example as a triangulation, or as
`o10_019758` from the census), can we tell which slope was the meridian, and so recover $X$? In our situation, yes. The meridian
is the only slope that dies in the homology of $E$ (rationally). In the closed manifold $X$ the meridian is of course trivial,
since it bounds a disc; the point is that it is already trivial, up to torsion, in $E$, where we can detect it without
knowing $X$.

**Lemma 9.1 (rational longitudes).** Let $X$ be a closed orientable 3-manifold, $\gamma_1,\dots,\gamma_r\subset X$ disjoint knots,
$E=X\setminus N(\gamma_1\cup\dots\cup\gamma_r)$ with boundary tori $T_i$, meridians $\mu_i$ and longitudes $\ell_i$ (parallel copies of $\gamma_i$).
1. $\mu_i$ is zero in $H_1(E;\mathbb Q)$ if and only if there is a class $\beta\in H^1(X;\mathbb Q)$ with $\beta(\gamma_i)\ne0$ and
   $\beta(\gamma_j)=0$ for all $j\ne i$; equivalently, $[\gamma_i]\notin\operatorname{span}\{[\gamma_j]:j\ne i\}$ in $H_1(X;\mathbb Q)$.
2. If this holds, $\mu_i$ is the **only** slope on $T_i$ that is zero in $H_1(E;\mathbb Q)$ (the *rational longitude* of $T_i$).
3. If it holds for all $i$, i.e. **the classes $[\gamma_1],\dots,[\gamma_r]$ are linearly independent in $H_1(X;\mathbb Q)$**, then restriction
   $H^1(X;\mathbb Q)\to H^1(E;\mathbb Q)$ is an isomorphism, and $b_1(E)=b_1(X)$.

*Proof.* (1) Put $X'=E\cup N(\gamma_i)=X\setminus N(\bigcup_{j\ne i}\gamma_j)$. A class on $E$ extends over the solid torus $N(\gamma_i)$ iff it
vanishes on $\mu_i$, and the obstruction is measured by the exact sequence of the pair $(X',E)$:
$$H^1(X')\to H^1(E)\xrightarrow{\ c\mapsto c(\mu_i)\ }H^2(X',E)\cong\mathbb Q\to H^2(X').$$
(Excision gives $H^2(X',E)\cong H^2(N(\gamma_i),T_i)\cong\mathbb Q$.) The last map sends the generator to the Poincaré–Lefschetz dual of
$\gamma_i$ in $H^2(X')\cong H_1(X',\partial X')$. So some class on $E$ is non-zero on $\mu_i$ (i.e. $\mu_i\ne0$ in $H_1(E;\mathbb Q)$) iff
$[\gamma_i]=0$ in $H_1(X',\partial X';\mathbb Q)$. Over a field, $H_1(X',\partial X')$ is dual to $H^1(X',\partial X')$: the classes on $X'$ that
vanish on $\partial X'$, i.e. on all $\mu_j,\ell_j$ for $j\ne i$. Those are exactly the restrictions of classes $\beta\in H^1(X)$ with
$\beta(\gamma_j)=0$ for $j\ne i$. So $\mu_i$ dies rationally in $E$ iff such a $\beta$ has $\beta(\gamma_i)\ne0$.
(2) Take $\beta$ from (1) and restrict it to $E$. Then $\beta(\mu_i)=0$ and $\beta(\ell_i)=\beta(\gamma_i)\ne0$, so every slope $p\mu_i+q\ell_i$
with $q\neq0$ has $\beta$-value $q\beta(\gamma_i)\ne0$ and is not zero in $H_1(E;\mathbb Q)$.
(3) Filling all $T_i$ along the meridians gives $X$, and $H_1(X)=H_1(E)/\langle\mu_1,\dots,\mu_r\rangle$ (van Kampen, or
Mayer–Vietoris). If all $\mu_i$ are rationally zero, the quotient map is an isomorphism over $\mathbb Q$; dualise. $\square$

*The one-knot case* ($r=1$): $\mu$ is torsion in $E$ iff $[\gamma]\ne0$ in $H_1(X;\mathbb Q)$. A direct proof: a surface $S$ dual to a
class $\beta$ with $\beta(\gamma)=n\neq0$ meets $\gamma$ in $n$ points algebraically, and $S\cap E$ is a surface whose boundary is $n$
meridian circles, so $n\mu=0$ in $H_1(E)$. With two knots this argument only gives $n_1\mu_1+n_2\mu_2=0$, which is why (1) needs
the independence condition.

*Example.* For a knot in $S^3$ ($b_1=0$, so the lemma does not apply) the meridian is not torsion: $H_1=\mathbb Z\mu$, and the
torsion slope is the Seifert longitude. Here it is the other way round, because $\gamma$ itself is homologically essential.

**Lemma 9.2 (filling is canonical).** In the situation of Lemma 9.1(3), let $X'\supset E'$ be another such pair. Every homeomorphism
$h\colon E\to E'$ maps each meridian of $E$ to a meridian of $E'$ and extends to a homeomorphism $\bar h\colon X\to X'$ that maps
the knots $\gamma_i$ onto the knots $\gamma'_j$ (in the order in which $h$ maps the tori). The extension is unique up to an isotopy
supported in the solid tori, and $\bar h^*$ on $H^1$ corresponds to $h^*$ under the isomorphisms of Lemma 9.1(3).

*Proof.* $h_*$ is an isomorphism $H_1(E;\mathbb Q)\to H_1(E';\mathbb Q)$ that commutes with the inclusions of the boundary tori:
$h_*\circ\iota_{T_i}=\iota_{h(T_i)}\circ(h|_{T_i})_*$. So it maps the kernel of $H_1(T_i;\mathbb Q)\to H_1(E;\mathbb Q)$ onto the kernel for $h(T_i)$.
By Lemma 9.1(2) these kernels are the lines of the meridians, so $h(\mu_i)$ is isotopic on $h(T_i)$ to $\pm$ a meridian.
Isotope $h$ near $\partial E$ so that $h(\mu_i)$ is exactly a meridian circle. A solid torus is a meridian disc $D$ times an
interval, glued up: extend $h$ over $D$ by coning from the centre (Alexander's trick), and then over the remaining 3-ball, again
by coning. Two extensions differ by a homeomorphism of the solid torus that is the identity on the boundary, and Alexander's
trick isotopes it to the identity rel boundary. The cores are mapped to the cores. The statement about $H^1$ holds because
restriction commutes with $\bar h$. $\square$

So the drilled manifold determines the closed manifold and the knots, and an identification of drilled manifolds determines
one of closed manifolds. This is what "the filling slopes are canonical" means.

**Consequence.** For a fibration of $E$ whose fibre meets $T_i$, the boundary circles of the fibre on $T_i$ all have the slope on
which the fibre class vanishes. Under Lemma 9.1, every class vanishes on $\mu_i$, so **all fibres of $E$ meet $T_i$ in
meridians**, and filling the meridian fills in the punctures. In the cut chain, $[\Sigma]$ meets $\gamma_k$ in $|P_k|$ and $\sigma_k$ in
$|Q_k|$ points, and $[\gamma_k],[\sigma_k]$ are independent in $H_1(M_f;\mathbb Q)$ (§11, Lemma 11.3), so Lemmas 9.1 and 9.2 apply to
both cusps of $\dot M_k$ at once.

## 10. Veering triangulations and Agol's construction

**Ideal triangulations.** An *ideal triangulation* of a cusped 3-manifold is a decomposition into tetrahedra with their
vertices removed (the vertices sit "at the cusps"). Similarly, an ideal triangulation of a punctured surface uses triangles
whose vertices are punctures.

**Taut and veering.** An ideal triangulation is *taut* if each tetrahedron carries dihedral angles $0,0,0,0,\pi,\pi$ such that
the angles around every edge sum to $2\pi$. Picture each tetrahedron as a flattened square: the two edges with angle $\pi$ are
the *top* and *bottom diagonals*, the other four are *equatorial*; the two bottom faces lie below, the two top faces above.
All faces can then be co-oriented "upwards" consistently. A taut triangulation is *veering* if the edges can be coloured
red and blue so that in every tetrahedron, seen from above, the four equatorial edges are coloured red, blue, red, blue
going anticlockwise from an end of the top diagonal (Agol; Hodgson–Rubinstein–Segerman–Tillmann).

**The flip.** In an ideal triangulation of a surface, the two triangles adjacent to an edge $e$ form a quadrilateral with
sides $a,b,c,d$ (cyclic order). The *flip* replaces $e$ by the other diagonal $e'$. A taut tetrahedron is a flip seen in space:
its bottom faces are the two old triangles, its top faces the two new ones. A *layered* triangulation is one built by
stacking such flips between two triangulations of a surface and gluing the top to the bottom.

**Train tracks ↔ weighted triangulations.** On the *fully punctured* surface $S^\circ$ (all singularities and punctures
removed), a trivalent measured train track whose complementary regions are once-punctured polygons is dual to an ideal
triangulation: one triangle per switch, one edge per branch, weights $w$ = the branch weights. The switch condition says
that in every triangle one weight (the *large* edge, the large branch of the switch) is the sum of the other two.

**The flip formula.** The weight of an edge is the transverse measure of the lamination crossing it. Inside the quadrilateral,
the leaves of the lamination run between the sides; those crossing $e$ go from $\{a,b\}$ to $\{c,d\}$. Counting leaves that
cross both diagonals, one gets the tropical Ptolemy relation
$$w(e)+w(e')=\max\bigl(w(a)+w(c),\,w(b)+w(d)\bigr).$$
Splitting a large branch of the track is the flip of its dual edge with this new weight.

**Theorem 10.1 (Agol 2011).** Let $\varphi$ be pseudo-Anosov on $S^\circ$, and start with a measured train track carrying its
(un)stable lamination. Repeatedly flip *all* edges of maximal weight ("maximal splitting"). The sequence becomes periodic up to
$\varphi$ and rescaling by $\lambda$: $T_{n+m}=\varphi(T_n)$ with weights $w_{n+m}=\lambda^{-1}w_n\circ\varphi^{-1}$. Stacking one
tetrahedron per flip of one period and gluing the top to the bottom by $\varphi$ gives a layered **veering** triangulation of
$M_\varphi^\circ$. It depends only on the fibred face of $[S^\circ]$ (Agol; Minsky–Taylor; Guéritaud): **two maps with
combinatorially isomorphic veering triangulations are monodromies of the same manifold in the same fibred face.**

**Theorem 10.2 (Minsky–Taylor; Landry–Minsky–Taylor).** A class is *carried* by a layered veering triangulation if it is
represented by a non-negative integer combination of faces (a cocycle that is $\ge0$ on upward-oriented faces). The carried
classes form exactly the cone over the fibred face. By Farkas' lemma, this cone is dual to the cone generated by the
directed cycles of the upward dual graph (tetrahedra as vertices, faces as edges from the tetrahedron below to the one
above): $\alpha$ is in the open cone iff $\alpha>0$ on every directed cycle.

The directed cycles of the dual graph play the role of Fried's homology directions: they are closed curves transverse to the
2-skeleton and positively transverse to every fibre in the face.

**How precisely "depends only on the face" holds.**
- *Combinatorially.* The triangulation is a finite list of tetrahedra and face gluings. "Depends only on $(M,F)$" means: two
  pseudo-Anosovs in the same face (of the same manifold, or of homeomorphic manifolds via a homeomorphism that maps face to face)
  give **isomorphic** lists. This is the theorem of Agol and Minsky–Taylor quoted in 10.1. Behind it is Lemma 5.5: both
  monodromies are first-return maps of one flow $\psi_F$, and Guéritaud builds the triangulation from the stable and unstable
  foliations of that flow, without choosing a fibre.
- *Inside $M$.* The triangulation sits in $M$ up to isotopy: Agol's construction realises it in the mapping torus of the given
  map, and Lemma 5.5 moves it into $M$ by a homeomorphism isotopic to the identity.
- *Isomorphisms give homeomorphisms.* A combinatorial isomorphism $V\to V'$ (tetrahedra to tetrahedra, faces to faces) defines a
  homeomorphism of the underlying cusped manifolds by mapping each tetrahedron affinely onto its image. Two homeomorphisms that
  realise the same isomorphism are isotopic (straight-line isotopy in each truncated tetrahedron).
- *Co-orientation.* An isomorphism that keeps the upward co-orientation of the faces maps carried classes to carried classes,
  hence fibred face to fibred face (Theorem 10.2). By Lemma 5.5 it then maps the face flow to the face flow, up to isotopy.
  By Corollary 2.3, a homeomorphism of hyperbolic manifolds is isotopic to one of finitely many isometries. So among all
  homeomorphisms $\dot M\to\dot M'$, at most finitely many preserve the veering triangulation with its co-orientation. When there is
  exactly one, as in Computation 12.4, the identification is forced: no choice is involved.

*Example.* For the once-punctured torus, Agol's triangulation of the monodromy $R^{a_1}L^{b_1}\cdots$ is the monodromy
(Floyd–Hatcher) triangulation with one tetrahedron per letter; `m004` = $RL$ has two.

---

# Part II — The cut chain

## 11. Setting and notation

- $\Sigma$: the closed surface of genus 2. The start-menu example is a word in point pushes and Lickorish twists on the
  once-punctured surface; its **closed class** is $f=D_d^{-1}D_{c_1}^{-1}D_a^{-1}$ (the pushes vanish, §8).
- **Computation 11.1 (the closed class).** On $H_1(\Sigma)$, $f_*$ has matrix (columns: images of $a,b,c,d$ in the
  point-push setup)
  $$\begin{pmatrix}0&-1&1&-1\\1&1&-1&1\\0&0&1&-1\\-1&0&1&0\end{pmatrix},\qquad \chi_{f_*}(x)=(x-1)^2(x^2+1),$$
  and $f_*^4-I$ has rank 1: $f^4$ acts like a power of the transvection along $[\delta]=a+c$. The twist-only lift on
  $\Sigma\setminus p$ is reducible along `b a B c` and `A D C d` (the two boundary curves of the neighbourhood of the 3-chain
  $d,c_1,a$, which become one curve $\delta$ once $p$ is filled), and the remaining piece is a graph automorphism of order 4.
  So $f$ is a **fractional Dehn twist**: periodic of order 4 on $\Sigma\setminus\delta$, twisting along $\delta$. Its mapping torus
  $M_f$ is a graph manifold with JSJ torus $T_\delta$.
- **Stages.** Stage $k$ is a pseudo-Anosov $\varphi_k$ on $\Sigma\setminus P_k$ with the closed class $f$; $Q_k$ is the singular orbit
  that is cut; the cut gives stage $k+1$ on $\Sigma\setminus Q_k$, so $P_{k+1}=Q_k$.
- **3-manifolds.** $\gamma_k,\sigma_k\subset M_f$ the suspensions of $P_k,Q_k$; $M_k=M_f\setminus\gamma_k$ (the mapping torus of $\varphi_k$),
  $\dot M_k=M_f\setminus(\gamma_k\cup\sigma_k)$ (fully punctured). In $\dot M_k$ the cusp $c_p$ (around $\gamma_k$) is the *puncture
  cusp*, $c_s$ (around $\sigma_k$) the *singular cusp*.

### What is identified with what

Every stage has its own homeomorphism $\varphi_k$, its own suspension flow $\psi_k$ and its own mapping torus. The bullet above
puts all of them into **one** manifold $M_f$. This subsection says how, and which statements are literal and which only hold up
to isotopy.

**(I1) Each stage in $M_f$.** $\varphi_k$ extends over the punctures (as 1-prongs) to a homeomorphism $\bar\varphi_k$ of $\Sigma$, isotopic
to $f$ (it is a representative of the closed class). Lemma 1.3 gives $\Psi_k\colon M_f\to M_{\bar\varphi_k}$, unique up to isotopy and
with $\Psi_k^*[\Sigma]=[\Sigma]$. Define
$$\gamma_k=\Psi_k^{-1}(\text{suspension of }P_k),\qquad \sigma_k=\Psi_k^{-1}(\text{suspension of }Q_k),\qquad \psi_k=\Psi_k^{-1}\circ(\text{suspension flow})\circ\Psi_k.$$
These are knots and a flow in $M_f$, well defined up to an isotopy of $M_f$. So: **one closed manifold, one fibre class
$[\Sigma]$, but at each stage a different flow $\psi_k$ and different knots.** $\gamma_k$ is the 1-prong orbit and $\sigma_k$ the
3-prong orbit of the same flow $\psi_k$. (The algorithm itself gives $\varphi_k$ only up to conjugation by homeomorphisms isotopic to
the identity rel $P_k$. By Lemma 1.3 this changes $\gamma_k,\sigma_k,\psi_k$ only by an isotopy of $M_f$.)

**Lemma 11.2 (the next puncture orbit is the old singular orbit).** $\gamma_{k+1}$ is isotopic to $\sigma_k$ in $M_f$.

*Proof.* By construction of the cut (port notes 15, 26), $\bar\varphi_{k+1}$ is isotopic to $\bar\varphi_k$ rel $Q_k=P_{k+1}$. Lemma 1.3 (relative
version) gives $\Psi\colon M_{\bar\varphi_k}\to M_{\bar\varphi_{k+1}}$ mapping the suspension of $Q_k$ to the suspension of $P_{k+1}$. Now
$\Psi_{k+1}^{-1}\Psi\Psi_k$ is a homeomorphism $M_f\to M_f$ of the kind built in Lemma 1.3 (from $f$ to itself), hence isotopic to
the one built from the constant isotopy, which is the identity. So $\gamma_{k+1}=\Psi_{k+1}^{-1}\Psi\Psi_k(\sigma_k)$ is isotopic to
$\sigma_k$. $\square$

So each knot is an orbit of **two** consecutive flows: $\sigma_k\simeq\gamma_{k+1}$ is the singular orbit of $\psi_k$ and the puncture
orbit of $\psi_{k+1}$. The flows themselves differ: $\psi_k$ and $\psi_{k+1}$ are not isotopic, since their 1-prong orbits $\gamma_k$ and
$\gamma_{k+1}$ are not isotopic (already their homology classes differ: $[\Sigma](\gamma_k)=|P_k|\ne|P_{k+1}|$).

**(I2) The drilled manifolds.** $M_k$ and $\dot M_k$ are complements of these knots, so they are defined up to homeomorphisms
that extend to homeomorphisms of $M_f$ isotopic to the identity. Such homeomorphisms act trivially on $H^1(M_f)$, hence (Lemma
9.1(3)) trivially on $H^1(M_k)$ and $H^1(\dot M_k)$. **On cohomology, everything is canonical.**

**(I3) The veering triangulation $V_k$** is built from the train track of $\varphi_k$ alone (§15), before the algorithm runs on the
next stage. It triangulates the fully punctured mapping torus, i.e. $\dot M_k$, which already contains the next puncture orbit
$\sigma_k\simeq\gamma_{k+1}$ as its singular cusp. So **one stage's data sees two consecutive puncture curves.** That is why the
two-cusped $\dot M_k$, and not $M_k$, is the right object to compare.

**(I4) Identifying stages.** For stages $j,k$, a co-orientation preserving isomorphism $V_j\to V_k$ gives a homeomorphism
$h\colon\dot M_j\to\dot M_k$, unique up to isotopy (§10). In Computation 12.4 there is exactly one such isomorphism, so $h$ involves no
choice. By Lemma 11.3 and Lemma 9.2, $h$ extends to a homeomorphism $\bar h\colon M_f\to M_f$ with $\bar h(\gamma_j)=\gamma_k$ and
$\bar h(\sigma_j)=\sigma_k$ (Computation 12.4 shows that $h$ maps $c_p$ to $c_p$). **$\bar h$ is not isotopic to the identity**: it acts
non-trivially on $H^1(M_f)$ (§14). By §10, $h$ maps the face flow of $\dot M_j$ to that of $\dot M_k$, up to isotopy: **the flows
$\psi_j$ and $\psi_k$ are not isotopic, but they are conjugate**, by a homeomorphism of $M_f$ that moves the knots.

**(I5) Classes.** All $H^1$ are identified with $H^1(M_f;\mathbb Q)\cong\mathbb Q^2$ by restriction (Lemma 9.1(3)). The model is stage p2;
its fibre class is $e_1:=[\Sigma]$. Stage $k$ in model coordinates is $\bar h_k^*[\Sigma]$, where $h_k\colon\dot M_{\rm model}\to\dot M_k$ is
the isomorphism of (I4).

**Lemma 11.3 (independence of the two knots).** For every computed stage, $[\gamma_k]$ and $[\sigma_k]$ are linearly independent in
$H_1(M_f;\mathbb Q)$. Hence Lemmas 9.1 and 9.2 apply to both cusps of $\dot M_k$: both meridians are torsion in $H_1(\dot M_k)$, the
meridians are the canonical filling slopes, and $H^1(M_f;\mathbb Q)\to H^1(\dot M_k;\mathbb Q)$ is an isomorphism.

*Proof.* $H_1(M_f)=H_1(\dot M_k)/\langle\mu_p,\mu_s\rangle$. SnapPy and our cohomology code both give $b_1(\dot M_k)=2=b_1(M_f)$ (Computation
12.3). So the quotient map is an isomorphism over $\mathbb Q$, both meridians are rationally zero, and Lemma 9.1(1) turns this into the
independence. (In model coordinates: $[\gamma]\mapsto(6,1)$ and $[\sigma]\mapsto(10,1)$, see Computation 12.4, with determinant $-4\ne0$.)
$\square$

## 12. What the computations show for the example

**Computation 12.1 (the chain).** Both possible first moves lead into an endless forced chain (one singular orbit from the
second stage on):

| stage | $P$ | $\lambda$ | $\log\lambda\cdot(P+2)$ | class in the model (§14) |
|---|---|---|---|---|
| preset | 1 | 6.4461759967 | 5.59 | (different manifold) |
| p1 | 2 | 1.8832035059 | 2.53 | $e_1-4e_2$ |
| p2 | 6 | 1.4012683679 | 2.70 | $e_1$ |
| p3 | 10 | 1.2756168684 | 2.92 | $e_1+4e_2$ |
| p4 | 14 | 1.2141433183 | 3.10 | $e_1+8e_2$ |
| p5 | 18 | 1.1768619228 | 3.26 | $e_1+12e_2$ |
| p10 | 38 | 1.0987695456 | 3.77 | $e_1+32e_2$ |
| p15 | 58 | 1.0704290376 | 4.08 | |
| p24 | 94 | 1.0475554823 | 4.46 | |
| q2 | 5 | 1.4579874796 | 2.64 | $e_1-e_2$ |
| q3 | 9 | 1.2980285068 | 2.87 | $e_1+3e_2$ |
| q8 | 29 | 1.1222232402 | 3.58 | $e_1+23e_2$ |

(The q-branch starts $1\to3\to5$; at $P=3$ there are two singular orbits, of lengths 2 and 5. The q-chain was followed to
$P=73$, where the app could no longer carry out the move.)

**Computation 12.2 (one polynomial).** For every stage from p1 and q2 on (45 stages, up to $P=94$), $\lambda$ is the largest root
of $G_{P+2}$ to within $7\cdot10^{-14}$, and for minimal train tracks the characteristic polynomial of the transition matrix
is **exactly** $(x+1)\,G_{P+2}(x)$ (exact integer arithmetic).

**Computation 12.3 (one manifold).** Agol's veering triangulation of $\dot M_k$ (computed from our train tracks, §15) has
**26 tetrahedra** for every stage from p1 and q2 on (p1–p10, q2–q8 checked); it is taut and veering, and SnapPy finds a
complete hyperbolic structure with all tetrahedra positively oriented. All these $\dot M_k$ are isometric (volume
$8.5851121432$, $H_1=\mathbb Z^2\oplus\mathbb Z/4$, symmetry group $\mathbb Z/2\oplus\mathbb Z/2$, containing an isometry that **swaps the two
cusps**). Filling either cusp along its rational longitude gives the census manifold **`o10_019758`** (volume
$5.7346906416$, $H_1=\mathbb Z^2$); filling both gives a non-hyperbolic manifold with $H_1=\mathbb Z^2$, i.e. $M_f$. (The preset's own
stage gives a different, three-cusped manifold with 34 tetrahedra.)

**Computation 12.4 (the classes and the cone).** Take the triangulation $V$ of stage p2 as the model and let $e_1$ be its fibre
class. For every other stage there is exactly one co-orientation preserving isomorphism of veering triangulations from $V$;
pulling the fibre class back gives $e_1+(P-6)e_2$ for a fixed second class $e_2$ (table above). The upward dual graph of $V$ has
11865 simple directed cycles with 16 distinct classes, among them $(2,0)$, $(4,0)$ and $(6,1)$ in the coordinates
$(e_1(z),e_2(z))$. Hence (Theorem 10.2) the fibred cone of $V$ is
$$C(V)=\{a\,e_1+b\,e_2:\ a>0,\ b>-6a\}.$$
The Thurston norm on it is $x_{\dot M}(a,b)=18a+2b$ (the fully punctured fibre has $|\chi|=2P+6$); on $M=$ `o10_019758` it is
$x_M(a,b)=8a+b$ ($|\chi(\Sigma\setminus P)|=P+2$).

*How $e_2$ is chosen, and the values on the cusps.* The script takes $e_1$ = the fibre cocycle of $V$ and $e_2$ = the first
cocycle of a computed basis of $H^1$ that is independent of $e_1$; a priori this is an arbitrary choice. It is pinned down by
the data: the classes of consecutive stages differ by $4e_2$, so $e_2=\tfrac14(\text{class of stage }k+1-\text{class of stage }k)$ is
intrinsic. Its meaning is Proposition 14.8. Evaluate on the core curves $\ell_p,\ell_s$ of the model's two cusps. If $h_k$ maps $c_p$
to $c_p$, then $\bar h_k^*[\Sigma](\ell_p)=[\Sigma](\gamma_k)=P$, so $e_1(\ell_p)+(P-6)e_2(\ell_p)=P$ for all stages, and therefore
$$e_1(\ell_p)=6,\quad e_2(\ell_p)=1,\qquad e_1(\ell_s)=10,\quad e_2(\ell_s)=1 \quad(\text{from }|Q|=P+4).$$
The isomorphisms do map $c_p$ to $c_p$. For $k=$ p2 the isomorphism is the identity, so $e_1(\ell_p)=6$. If $h_k$ swapped the cusps for
some stage, then $6+(P-6)e_2(\ell_p)$ would have to equal $P+4$ there and $P$ at the others. At $P=2$ and $P=10$ this forces
$e_2(\ell_p)\in\{0,1\}$ and $e_2(\ell_p)\in\{1,2\}$, so $e_2(\ell_p)=1$, and then no stage with $P\ne6$ can be swapped.

## 13. Elementary facts

**Proposition 13.1 (+4 per move).** If at stage $k$ all punctures are 1-prongs and all singularities 3-prongs, then $|Q_k|=|P_k|+4$.

*Proof.* Corollary 7.2 with $g=2$. $\square$ (Proposition 16.2 treats the general case with persistent singularities.)

**Proposition 13.2 (one orbit = one closed orbit).** If the 3-prong singular set of $\varphi_k$ is the intersection of the fibre with a
single closed orbit $\sigma$ of the suspension flow, it is one cyclic orbit of length $\langle[\Sigma],\sigma\rangle$.

*Proof.* §3: successive crossings of one closed curve with the fibre are permuted cyclically by the first-return map. $\square$

So "why are all singular vertices in one orbit?" becomes "why does the flow have only one singular closed orbit?". By §5
this is a property of the **fibred face**, the same for all its classes. Once all stages lie in one face (§14), one orbit at
one stage means one orbit at all stages.

**Proposition 13.3 (how a chain can stop).** Let $f$ be the closed class.
1. If some stage has a pseudo-Anosov $\varphi_k$ in which all punctures have $\ge2$ prongs, filling them gives a pseudo-Anosov
   representative of $f$. So **if $f$ is not pseudo-Anosov, the chain never ends with "pseudo-Anosov"**.
2. If $f$ is not pseudo-Anosov, the chain stops exactly when some stage is reducible or of finite order rel $P_k$, i.e. (by
   §2) when $M_k=M_f\setminus\gamma_k$ is **not hyperbolic**.
3. If $f$ is pseudo-Anosov, the chain stops when some stage has punctures with $\ge2$ prongs, and then the result is $f$ (with
   the right $\lambda$, Computation 16.1). Nothing forces this to happen: see §16.

*Proof.* (1) A $k$-prong with $k\ge2$ at a filled puncture is a regular point ($k=2$) or an allowed singularity ($k\ge3$), so the
invariant foliations of $\varphi_k$ extend over $\Sigma$, and $\varphi_k$ (isotopic to $f$ on $\Sigma$) is pseudo-Anosov. (2) Each stage is
classified by the algorithm; with one cusp everywhere it offers the closed-surface move again, otherwise it reports
"reducible" or "finite order"; Thurston's theorem translates this into the geometry of the mapping torus. (3) is (1) read
backwards. $\square$

**Lemma 13.4 ("isotoped off the torus").** If $\gamma_k$ is isotopic in $M_f$ to a curve disjoint from the JSJ torus $T_\delta$,
then $\varphi_k$ is reducible or periodic rel $P_k$.

*Proof.* Isotope $\gamma_k$ off $T_\delta$. The torus $T_\delta$ is incompressible in $M_f$, so it is incompressible in
$M_f\setminus\gamma_k$ (a compressing disc there would be one in $M_f$). It is not parallel to the new boundary torus
$\partial N(\gamma_k)$: otherwise it would bound a solid torus around $\gamma_k$ in $M_f$ and hence be compressible in $M_f$. As
$M_f$ is closed, there is no other boundary. So $M_k=M_f\setminus\gamma_k$ contains an essential torus, is not hyperbolic, and
by Thurston's theorem (§2) $\varphi_k$ is not pseudo-Anosov rel $P_k$. $\square$

This is the precise meaning of "**reducibility is never detected because the puncture orbit cannot be isotoped off the
torus**". On the surface: there is no homeomorphism isotopic to $\varphi_k$ that keeps $P_k$ invariant *and* preserves a curve
isotopic to $\delta$ (in $\Sigma$) that avoids $P_k$. In the 3-manifold: every knot $\gamma_k$ of the chain meets the JSJ torus
essentially. The converse, and much more, follows from Computation 12.3: every $M_k$ is the hyperbolic manifold `o10_019758`.
The reason for "essentially" is homological: every $\gamma_k$ meets $T_\delta$ algebraically once (Corollary 14.9).

## 14. A cut in 3-manifold terms, and the proof

The idea of the proof: a cut is an operation on (manifold, fibre class) pairs that commutes with isomorphisms. If the
operation maps a model pair to an isomorphic copy of itself with the class shifted by a fixed linear map, we can iterate
forever, as long as the shifted classes stay in the fibred cone. Lemmas 14.1–14.5 supply the pieces; Theorem 14.6 puts them
together.

**Lemma 14.1 (naturality of a cut).** Stage $k+1$ is the monodromy of the fibration of $M_f\setminus\sigma_k=\dot M_k(c_p\text{ filled})$ in
the class $[\Sigma]$. Hence the pair (drilled manifold with its two cusps and veering triangulation, fibre class) of stage $k+1$ is
determined, up to isomorphism, by that of stage $k$; isomorphic stages have isomorphic successors.

*Proof.* The cut and the shortcut both produce the pseudo-Anosov representative of the class of $\varphi_k$ rel $Q_k$ (port notes 15,
26). The mapping torus of $\varphi_k$ on $\Sigma$ is $M_f$ (after filling, $\varphi_k$ is isotopic to $f$), and $Q_k$ suspends to $\sigma_k$, so the
class of $\varphi_k$ rel $Q_k$ is the monodromy of $M_f\setminus\sigma_k$ in the fibre class. By Lemma 9.1, the filling of the cusp $c_p$
(which gives back $M_f\setminus\sigma_k$ from $\dot M_k$) is determined by $\dot M_k$ alone. Every step is defined topologically, so
an isomorphism of stage-$k$ data induces one of stage-$(k+1)$ data. $\square$

**Lemma 14.2 (filling a singular orbit keeps the cone).** Let $N=X\setminus N(\gamma)$ be hyperbolic, for a closed $X$ and a knot $\gamma$,
with fibred face $F$, flow $\psi_F$, and a singular closed orbit $\sigma$ such that $[\gamma],[\sigma]$ are independent in $H_1(X;\mathbb Q)$
(in the chain: Lemma 11.3). Then, under the isomorphism $H^1(N;\mathbb R)\cong H^1(N\setminus\sigma;\mathbb R)$ of Lemma 9.1(3), the cone over
$F$ equals the cone over the fibred face of $N\setminus\sigma$ that contains the punctured fibres.

*Proof.* Let $\dot\psi$ be $\psi_F$ restricted to $\dot N=N\setminus\sigma$; it is the suspension flow of the monodromies punctured at their
singularities on $\sigma$, so it is again a pseudo-Anosov flow, and its face $\dot F$ is the one containing the punctured fibres.

*Cone of $F$ $\subseteq$ cone of $\dot F$.* A fibre of a class $\alpha$ in the cone of $F$ is a cross-section of $\psi_F$ (Theorem 5.4), meets
$\sigma$ transversally, and $S\setminus\sigma$ is a cross-section of $\dot\psi$. By Theorem 5.3, $\alpha$ restricted to $\dot N$ is in the cone of $\dot F$.

*Cone of $\dot F$ $\subseteq$ cone of $F$.* Let $\alpha$ be in the cone of $\dot F$, i.e. positive on the homology directions of $\dot\psi$. The
homology directions of $\psi_F$ are those of $\dot\psi$ together with the direction of $\sigma$ (orbits of $\psi_F$ either avoid $\sigma$, and are
orbits of $\dot\psi$, or are $\sigma$; long segments near $\sigma$ follow $\sigma$). On $\sigma$: a fibre of $\alpha$ in $\dot N$ has boundary circles on the
cusp of $\sigma$ of the rational-longitude slope (Lemma 9.1), and the flow lines near $\sigma$ wind around in the direction of $\sigma$
and cross the fibre positively; so $\alpha(\sigma)>0$. By Theorem 5.4, $\alpha$ is in the cone of $F$. $\square$

**Lemma 14.3 (the class is all that matters).** Two stages with isomorphic (manifold, cusps, class) data have isomorphic
successors; the successor of the model class $\alpha$ depends only on which fibred face of $\dot M(c_p\text{ filled})$ contains $\alpha$.

*Proof.* The first part is Lemma 14.1. For the second: in $N^\circ:=\dot M(c_p\text{ filled})$ the successor is the monodromy of
the class $\alpha$; by Theorem 5.4 it is the first-return map of the flow $\psi_{F'}$ of the face $F'$ containing $\alpha$. Its
singular orbits, hence the next drilled manifold $N^\circ\setminus\sigma'$ and its veering triangulation, are those of $F'$. $\square$

*"The same" here is meant literally* (sense 1 of §5). Fix one flow $\psi_{F'}$ on $N^\circ$. Its singular orbit $\sigma'$ is one fixed
knot in $N^\circ$, and $N^\circ\setminus\sigma'$ is one fixed manifold. For each $\alpha$ in the cone, the successor computed by the algorithm
agrees with the first-return map of $\psi_{F'}$ only up to an isotopy of $N^\circ$ (Lemma 5.5). That isotopy acts trivially on
cohomology (§5), so the successor's class, read in $H^1(N^\circ\setminus\sigma')$, is $\alpha$ itself.

**Lemma 14.4 (prongs are constant on a face).** In the situation of Lemma 9.1, the number of prongs at each puncture along a
cusp is the same for all fibres in a fibred face.

*Proof.* The singular leaves of the stable foliation of $\psi_F$ that run into the cusp meet the cusp torus in finitely many
parallel closed curves of one slope $d$, the *degeneracy slope* (they do not depend on the class, since the flow does not).
A boundary circle of a fibre is a curve of the fibre's boundary slope, which is the rational longitude $\mu$ for every class
(Lemma 9.1, as $\alpha(\mu)=0$ for all $\alpha$). Its prongs are its intersections with the degeneracy curves, so their number is the
geometric intersection of $\mu$ with the degeneracy curves, independent of the class. $\square$

**Lemma 14.5 (a linear norm forces one face).** Let $b_1(M)=2$ and let $\alpha_1,\dots,\alpha_n$ ($n\ge3$) be fibred classes on an affine
line $L$ not through $0$, with $x(\alpha_i)=\ell(\alpha_i)$ for one linear function $\ell$. Then all $\alpha_i$ lie in the cone over one
fibred face.

*Proof.* Order the classes along $L$; let $p_1$ and $p_n$ be the outermost.
1. *$x=\ell$ on the segment $[p_1,p_n]$.* $x$ is convex (a seminorm). For $q\in[p_i,p_{i+1}]$, convexity gives
   $x(q)\le\ell(q)$ (the chord between two points where $x=\ell$ lies above the graph). Conversely, suppose $x(q)<\ell(q)$ for some
   $q\in(p_i,p_{i+1})$, and pick a third point $p_j$ on the other side of $p_{i+1}$ (or of $p_i$; one exists because $n\ge3$).
   Then $p_{i+1}$ is a convex combination $t\,q+(1-t)\,p_j$ with $0<t<1$, and convexity gives
   $x(p_{i+1})\le t\,x(q)+(1-t)\,x(p_j)<t\,\ell(q)+(1-t)\,\ell(p_j)=\ell(p_{i+1})$, a contradiction. So $x=\ell$ on all of $[p_1,p_n]$.
2. *No vertex ray crosses the open segment.* The unit ball of $x$ is a polygon (Theorem 4.2), and $x$ is linear on the cone over
   each edge, with dual vectors $\beta_1\ne\beta_2$ on two adjacent edges. Suppose the ray through the common vertex $v$ crossed $L$ at
   an interior point $q$ of the segment. Near $q$, on the two sides, $x=\beta_1$ and $x=\beta_2$; since $x=\ell$ there,
   $\beta_1$ and $\beta_2$ agree with $\ell$ along the direction $u$ of $L$, so $(\beta_1-\beta_2)(u)=0$. Also $\beta_1(v)=x(v)=\beta_2(v)$, so
   $(\beta_1-\beta_2)(v)=0$. As $L$ does not pass through $0$, $u$ and $v$ are linearly independent and span the plane, so $\beta_1=\beta_2$:
   a contradiction. (In words: where a line crosses a vertex ray transversally, the norm has a kink along the line.)
3. So the segment lies in the closed cone over a single edge $F$. Fibred classes are never on its boundary rays (Theorem 4.2,
   consequences), so all $\alpha_i$ lie in the open cone over $F$, which is therefore a fibred face. $\square$

*Why we need this.* The computations tell us, for many classes $\alpha_i$ on the line $\{e_1+be_2\}$, that the successor is a fibration
of $N^\circ$ with a fibre of known Euler characteristic. Without the lemma, different $\alpha_i$ could a priori lie in different
fibred faces of $N^\circ$, with different flows and different drilled manifolds, and their successors would not be related by one
fixed map. The lemma excludes that using only numbers we have computed: the Thurston norm of a fibred class is $|\chi|$ of its
fibre.

**Theorem 14.6 (the chain never ends) — computer-assisted.** For the start-menu example "Point push with Dehn twists", marked as
closed, the closed-surface move is needed infinitely often, for either choice at the first move. From the second stage on,
every stage is a fibration of `o10_019758` in the class $e_1+(P-6)e_2$ of the face of Computation 12.4.

*Proof.* Let $V$ be the model (stage p2) with drilled manifold $\dot M$, and $N^\circ:=\dot M(c_p \text{ filled})$, the manifold on which the
successor of a model class lives (Lemma 14.1).

1. *Base.* The computed stages (Computation 12.1) are identified with the model, with classes $e_1+be_2$ for
   $b\in B=\{-4,0,\dots,32\}\cup\{-1,3,\dots,23\}$ (Computation 12.4).
2. *One face for the successors.* For $b\in B$, the successor of $e_1+be_2$ is a fibration of $N^\circ$ (Lemma 14.1 transports the
   computed successor to the model) with fibre $\Sigma\setminus Q$, $|Q|=b+10$, so $x_{N^\circ}(e_1+be_2)=|\chi(\Sigma\setminus Q)|=b+12$.
   This is linear along the line, with $|B|\ge3$ points, and $b_1(N^\circ)=2$; by Lemma 14.5 these classes lie in one fibred cone
   $F'$ of $N^\circ$. By Lemma 14.3 all their successors have the same drilled manifold $\dot M'=N^\circ\setminus\sigma'$ and the same
   veering triangulation $V'$.
3. *The transition is a fixed shear.* Let $h\colon V\to V'$ be the unique co-orientation preserving isomorphism (Computation
   12.4) and $T=h^*\circ\iota$, where $\iota\colon H^1(\dot M;\mathbb Q)\to H^1(\dot M';\mathbb Q)$ is the natural isomorphism through $H^1(N^\circ)$
   (Lemma 9.1(3), twice). The successor of $e_1+be_2$ has model class $T(e_1+be_2)$, and the computations give
   $T(e_1+be_2)=e_1+(b+4)e_2$ for $b\in B$. A linear map is determined by two independent values:
   $T(e_1)=e_1+4e_2$ and $T(e_2)=e_2$. In terms of $M_f$: $\iota$ is induced by inclusions inside $M_f$, so it is the identity on
   $H^1(M_f)$, and $h$ extends to $\bar h\colon M_f\to M_f$ (Lemma 9.2) with $\bar h(\gamma)=\sigma$, $\bar h(\sigma)=\sigma'$. Hence
   **$T=\bar h^*$ on $H^1(M_f)$.**
4. *The face $F'$ is large.* By Lemma 14.2 and Theorem 10.2, the cone over $F'$ (in $H^1(N^\circ)\cong H^1(\dot M')$) is the cone
   carried by $V'$, which is $h_*C(V)$. In model coordinates: $F'=T^{-1}(C(V))=\{a>0,\ b+4a>-6a\}=\{a>0,\ b>-10a\}$, which
   contains $e_1+be_2$ for **all** $b>-10$.
5. *Induction.* Let a stage have model class $\alpha=e_1+be_2$ with $b\ge-4$ (p-branch) or $b\ge-1$ (q-branch). Then $\alpha\in F'$, so by
   Lemma 14.3 its successor is the monodromy of the face $F'$:
   - its punctures have one prong each, by Lemma 14.4 (it is one at the computed stages, and constant on the face);
   - its singular set is the single orbit $\sigma'$ of 3-prongs (Proposition 13.2 and §5, consequence 1);
   - so the algorithm, which finds the pseudo-Anosov representative and its train track, offers the closed-surface move
     again with a single orbit to cut; the next stage has model class $T\alpha=e_1+(b+4)e_2$, again in the range.

   By induction the move is needed at every stage. $\square$

### The two pictures, and what $e_1$ and $e_2$ are

**14.7 Two equivalent pictures.** The same data can be read in two ways.
- **Picture A (fixed class, moving knots).** In $M_f$ with each stage's own embedding (I1), every stage has the fibre class
  $[\Sigma]$, and the knots move: $\gamma_1,\gamma_2=\sigma_1,\gamma_3=\sigma_2,\dots$ with $\langle[\Sigma],\gamma_k\rangle=|P_k|$.
- **Picture B (fixed knots, moving class).** Pull everything back to the model by $\bar h_k$ (I4). The knots become the model's
  $\gamma,\sigma$, fixed once and for all, and the class becomes $\bar h_k^*[\Sigma]=e_1+(|P_k|-6)e_2$.

They are related by $\langle\bar h_k^*[\Sigma],\gamma\rangle=\langle[\Sigma],\bar h_k(\gamma)\rangle=\langle[\Sigma],\gamma_k\rangle=|P_k|$. Picture B is possible only
because $\bar h_k$ is **not** isotopic to the identity: an identification isotopic to the identity would fix $[\Sigma]$. So we
need to know what these self-homeomorphisms of $M_f$ are. Since $\dot M$ is hyperbolic, Corollary 2.3 allows only finitely many
of them per pair of stages; but each one maps one drilled manifold onto a *different* one ($\gamma\mapsto\sigma$), so iterating it
is not a self-map of a hyperbolic manifold, and rigidity does not bound its order. On $M_f$ it has infinite order.

**Proposition 14.8 ($e_2$ is the JSJ torus, and a cut is a torus twist).** Let $t\in H^1(M_f;\mathbb Z)$ be the class dual to the JSJ
torus $T_\delta$ (§2, §11), in the model's embedding. Then:
1. $e_2=\pm t$.
2. Every knot of the chain meets $T_\delta$ algebraically once: $\langle t,\gamma_k\rangle=\pm1$ and $\langle t,\sigma_k\rangle=\pm1$.
3. On $H^1(M_f)$, the step $T$ is the action of a **torus twist** along $T_\delta$: for a curve $c\subset T_\delta$, the twist
   $\tau_c$ is supported in a collar $T_\delta\times[0,1]$, where it is $(p,s)\mapsto(p+s\cdot c,\,s)$. It acts by
   $\tau_c^*\alpha=\alpha+\alpha(c)\,t$, and $T=\tau_c^*$ for any $c\subset T_\delta$ with $[\Sigma](c)=\pm4$ (sign as in 1).

*Proof.* (1) $\bar h$ (from Theorem 14.6, step 3) is a homeomorphism of $M_f$. The JSJ torus is unique up to isotopy, so
$\bar h(T_\delta)$ is isotopic to $T_\delta$, possibly with the opposite orientation, and $T(t)=\bar h^*t=\pm t$. So $t$ is an eigenvector
of $T$. But $T$ is a non-trivial shear, whose only eigenvectors are the multiples of $e_2$. So $t=\lambda e_2$ for some
$\lambda\in\mathbb Q$. Now $\lambda=t(\ell_p)=\langle t,\gamma\rangle\in\mathbb Z$, as $e_2(\ell_p)=1$ (Computation 12.4). The class $t$ takes the value $1$ on a
loop in a fibre that crosses $\delta$ once ($\delta$ is non-separating), so $e_2$ takes the value $1/\lambda$ there. But $e_2$ is integral:
it belongs to the integral basis dual to $X,T$ (Conjecture 16.6). Restriction from $M_f$ to $\dot M$ is an isomorphism on
$H^1(\,\cdot\,;\mathbb Z)$ as well, since the kernel of $H_1(\dot M)\to H_1(M_f)$ is generated by the torsion meridians. Hence $\lambda=\pm1$.
(2) $\bar h_k$ is a homeomorphism of $M_f$, so it also preserves $T_\delta$ up to isotopy: $\bar h_k^*t=\pm t$. Then
$\langle t,\gamma_k\rangle=\langle t,\bar h_k(\gamma)\rangle=\langle\bar h_k^*t,\gamma\rangle=\pm\langle t,\gamma\rangle=\pm e_2(\ell_p)=\pm1$. The same for $\sigma_k$, with $e_2(\ell_s)=1$.
(3) In the collar, a cycle that crosses $T_\delta$ once picks up one copy of $c$: $(\tau_c)_*z=z+\langle t,z\rangle\,c$. Dualise:
$\tau_c^*\alpha(z)=\alpha(z)+\langle t,z\rangle\,\alpha(c)$. With $t=\varepsilon e_2$, the map $\tau_c^*$ fixes $e_2$ (as $t(c)=0$ for a curve on $T_\delta$)
and sends $e_1=[\Sigma]$ to $e_1+\varepsilon[\Sigma](c)\,e_2$. This equals $T$ when $\varepsilon[\Sigma](c)=4$. $\square$

*Picture of the classes.* In $M_f$ with the model's embedding:
- **$e_1=[\Sigma]$** is the fibre of the model stage.
- **$e_2$ is the JSJ torus $T_\delta$**, the suspension of the curve $\delta$ along which $f$ twists. It lies on the boundary of
  the fibred cone and is not a fibre. In the drilled manifolds it is a punctured torus (each knot crosses it once). This matches
  the computed norms: $x_{\dot M}(e_2)=2$ (twice-punctured torus) and $x_M(e_2)=1$ (once-punctured torus).
- **The stage class $e_1+b\,e_2$** is represented by the oriented double-curve sum of $\Sigma$ and $b$ parallel copies of $T_\delta$.
  They meet along $b$ copies of $\delta$, and the cut-and-paste gives a closed surface with
  $\chi=\chi(\Sigma)+b\,\chi(T^2)=-2$: again $\chi=-2$, as it must be, because it represents the same class as the stage's fibre
  $\Sigma$ seen from the model, $\bar h_k^{-1}(\Sigma)$ (copies with the opposite orientation for $b<0$). The fixed knot $\gamma$ meets $\Sigma$ six times and each torus copy once, so it meets the surface $6+b=|P|$ times.
- **Each cut adds four copies of the JSJ torus to the fibre.** Equivalently, it pushes the fibre four times around through
  $T_\delta$: that is the torus twist of (3).

*Is $T$ induced by $f$?* No. On $M_f$, the map induced by $f$ is $(x,s)\mapsto(f(x),s)\sim(x,s+1)$, the time-1 map of the suspension
flow, which is isotopic to the identity (§2) and acts trivially on $H^1(M_f)$. The $4\times4$ matrix $f_*$ of Computation 11.1
acts on $H_1(\Sigma)$, i.e. inside one fibre. It enters only through Lemma 1.2: $b_1(M_f)=2$, and the rank-1 defect of $f_*^4-I$
is what produces the torus $T_\delta$ in the first place. The twist $T$ lives "across" the fibres.

*Where the 4 comes from.* Within this proof, from the index formula: $T(e_1)(\ell_p)=[\Sigma](\sigma)=|Q|=|P|+4$
(Proposition 13.1, $4=4g-4$). There is a second natural 4 on $T_\delta$. $f$ is periodic of order 4 on $\Sigma\setminus\delta$, and a
non-trivial orientation-preserving periodic map cannot fix a boundary circle pointwise. So the points of $\delta$ have period
exactly 4, and the regular Seifert fibres of the piece $M_f\setminus T_\delta$ meet $T_\delta$ in curves $c$ with $[\Sigma](c)=4$. So on
$H^1$, $T$ is the twist along the **Seifert fibre direction** of the JSJ torus. On $H^1$ only $[\Sigma](c)$ matters: twists along
$c$ and along $c+m\delta$ act identically. Whether the two 4s are related, and whether $\bar h$ itself is isotopic to such a twist
(not just equal to it on $H^1$), is open (Question 5 in §16). Genus 2 cannot tell them apart, because $4g-4=4$.

**Corollary 14.9 (homological reason for Lemma 13.4).** No $\gamma_k$ can be isotoped off $T_\delta$, because its algebraic
intersection number with $T_\delta$ is $\pm1$ (Proposition 14.8(2)), and algebraic intersection numbers are invariant under isotopy.

**What is computed, and how reliable it is.**

- *Exact:* characteristic polynomials (modular arithmetic and CRT); cohomology, cycles, cone and isomorphisms of the
  triangulations (rational arithmetic, exhaustive enumeration of the 11865 simple directed cycles).
- *Floating point:* the splitting sequences behind the veering triangulations use double precision with a relative tolerance of
  $10^{-9}$ for ties. A wrong tie would break periodicity or tautness; every triangulation passed the checks (periodic with scale
  exactly $1/\lambda$, taut, veering, positively oriented hyperbolic structure, isometric to each other, filling identified in
  the census without being told). A certificate would redo the splits in $\mathbb Z[\lambda]$, with $\lambda$ known exactly.
- *SnapPy:* isometry tests are numerical (not "verified" mode, which needs Sage). They are not used in the proof; only the
  combinatorial isomorphisms are.
- *Cited theorems:* Thurston (norm, fibred faces, hyperbolisation), Fried (cross-sections, flows), Agol and Minsky–Taylor
  (canonical veering triangulations), Landry–Minsky–Taylor (carried cone = fibred cone).

## 15. How the veering triangulations were computed

From the train track $\tau$ of each stage (our `train-track.ts`):
1. **Comb** it into a trivalent track (merge two branch ends on the same side of a switch into a new branch, repeatedly).
2. **Label** every triangle by its **cusp** (the corner between its two small edges). Splitting moves cusps but keeps them, so
   the labels persist through the whole sequence.
3. **Compute $\varphi$ on cusps** from $g_\tau$: reduce the images of the boundary words of the complementary regions and see where the
   cusp turns land.
4. **Split maximally** until the labelled triangulation repeats under $\varphi$ with all weights scaled by $1/\lambda$ (the scale
   came out as $1/\lambda$ to $10^{-9}$ in every case, an independent check).
5. **Layer**: one tetrahedron per flip of one period; glue the last layer to the first along the cusp map. Faces that survive
   a period are followed through $\varphi^{-1}$ until they are flipped; the number of periods a gluing wraps around is the value of
   the fibre cocycle on that face.

Code: `scripts/cut-study/veering*.ts`; port note 30.

## 16. Cut chains in general: what about 2000 examples show

The main study composed random words in point pushes and Dehn twists (genus 2 and 3), marked them closed, and explored the
tree of closed-surface choices (cut or shortcut at each orbit) with several policies: the app's default (smallest period
first), shortcut first, largest period first, and random walks.

**Computation 16.1 (overview).**
- 1960 examples, 10147 expansions, 4191 walks. Of the finished walks, 87% needed one cut; the longest finished walk needed 5.
- **The cut move gets the closed class right:** for all 160 examples whose closed class is pseudo-Anosov and whose chain
  finished, the final $\lambda$ equals the $\lambda$ of the twist-only reference word (§8) exactly.
- 69 examples had walks with $\ge8$ cuts. In 60 of them another choice of orbit ended the chain.

**Proposition 16.2 (growth per cut).** Suppose that along a chain in genus $g$ some singular orbits are never cut (*persistent*,
with index sum $s=\sum(1-k/2)\le0$), all punctures are 1-prongs, and at each stage the cut orbit consists of 3-prongs. Then
$$|P_{k+1}|=|P_k|+4g-4+2s.$$

*Proof.* At stage $k$ the singular data are $|P_k|$ 1-prongs, the persistent singularities and the cut orbit $Q_k$ of 3-prongs.
Theorem 7.1: $\tfrac12|P_k|+s-\tfrac12|Q_k|=2-2g$, so $|Q_k|=|P_k|+4g-4+2s$, and $P_{k+1}=Q_k$. $\square$

**Computation 16.3 (the rule in the data).** In genus 2 ($4g-4=4$), every long chain followed it exactly:

| example | persistent orbits | $s$ | growth per cut | $\lambda$ converges to |
|---|---|---|---|---|
| preset, `s106093` | none | $0$ | $+4$ | $1$ |
| `s104032` | one fixed 3-prong | $-\tfrac12$ | $+3$ | $1$ |
| `s106064` | one fixed 4-prong | $-1$ | $+2$ | $\varphi^2=2.61803$ (an Anosov piece) |
| `s521016` | 3-prongs in orbits of length 1 and 2 | $-\tfrac32$ | $+1$ | $3.50607=\lambda(f)$, $f$ pseudo-Anosov |
| `s482005` | one 4-prong, one 3-prong | $-\tfrac32$ | $+1$ | $4.79129=\lambda(f)$, $f$ pseudo-Anosov |

In each case $\lambda$ decreases monotonically and converges geometrically, e.g. for `s521016`:
$3.845,\ 3.584,\ 3.527,\ 3.512,\ 3.508,\ 3.5066,\ 3.5062,\ 3.50611,\ \dots\to3.506068$.

**Lemma 16.4 (entropy lower bound).** At every stage, $\log\lambda_k\ge h(f)$, the least entropy in the closed class: $\log\lambda(f)$ if
$f$ is pseudo-Anosov, the largest $\log\lambda$ of its pseudo-Anosov pieces if $f$ is reducible, $0$ if it has none.

*Proof.* The pseudo-Anosov $\varphi_k$ on $\Sigma\setminus P_k$ extends continuously over the punctures (as 1-prong singularities) to a
homeomorphism $\bar\varphi_k$ of $\Sigma$, isotopic to $f$, with the same topological entropy $\log\lambda_k$ (adding finitely many points
does not change entropy). Thurston representatives minimise entropy in their isotopy class (Fathi–Laudenbach–Poénaru,
Exposé 10), and the minimum is $h(f)$ as stated. $\square$

So the observed limits are exactly the lower bounds of the lemma: **endless chains converge to the closed class in entropy,
without ever reaching it.** For pseudo-Anosov $f$ this answers Question 3 of the first version negatively: a pseudo-Anosov
closed class does not force the chain to end.

**Computation 16.5 (the orbit choice).** In every long-chain example with a pseudo-Anosov closed class (14 of 14), cutting a
persistent small orbit (period 1, the app's default ordering) ended the chain after **one** cut with the right $\lambda$, while
"largest period first" never ended. Chains that are **forced** (one orbit at every decision after the first) were found in six
examples, all with a non-pseudo-Anosov closed class and all in the family $G_N$:

| example | punctures | $b=P-6$ mod 4 |
|---|---|---|
| preset (= `known:0`) | $2,6,10,\dots$ and $5,9,13,\dots$ | 0 and 3 |
| `known:1` | $4,8,12,\dots$ | 2 |
| `s106019` | $3,7,11,\dots$ | 1 |
| `s106093`, `s106031`, `s110094` | $1,5,9,\dots$ | 3 |

For these, $\lambda=$ largest root of $G_{P+2}$ at every stage from the first or second on. So **all four residue classes of the line
$e_1+be_2$ in the fibred cone of `o10_019758` are realised by ordinary words**, down to $b=-5$ ($P=1$), as Theorem 14.6 allows
($b>-6$). Two further never-ending examples (`s210014`, converging to $1.72208$; `s110003`, converging to $\varphi^2$) had a persistent
orbit whose cut the app could not carry out ("no cut found", shortcut errors), so whether they end is open.

**Conjecture 16.6 (λ-formula).** $\Theta(x,t)=(x-1)(t^2-1)-t(x^3+x^2+x^{-1}+x^{-2})$ is the Teichmüller polynomial of the fibred face of
`o10_019758` containing the chain, in the basis $X,T$ of $H_1/\text{torsion}$ with $e_1(X)=1$, $e_2(X)=0$, $e_1(T)=8$, $e_2(T)=1$.
Consequently $\lambda(e_1+be_2)$ is the largest root of $G_{b+8}$ for every $b>-6$. *Way to prove it:* compute the taut polynomial of
$V$ (§6).

**Consequences and context.**
- **Growth rates.** Assuming 16.6: for large $N$, $x^N\approx4/(x-1)$, so $\log\lambda_N\approx(\log N)/N$, and the normalised entropy
  $|\chi|\log\lambda\approx\log N$ grows (§5). Observed: $2.53, 2.70, \dots, 4.46$ at $P=94$.
- **Fixed genus, many punctures.** Tsai proved that for fixed genus $g\ge2$ the least dilatation on $S_{g,n}$ satisfies
  $\log\lambda_{\min}\asymp(\log n)/n$. The forced cut chains produce genus-2 examples of exactly this order; Kin–Kojima–Takasawa
  found such families as fibrations of the magic manifold. Brinkmann's family has $\lambda\to1$ with growing genus instead.
- **The two ends of the cone.** At $b\to-6$ ($P\to0$) the fibre stops meeting $\gamma$; at $b\to\infty$ the class approaches $e_2$. Both
  are boundary rays, where $\lambda\to1$. The cut is the shear $b\mapsto b+4$ towards the second one.
- **The cusp swap.** $\dot M_k$ has an isometry $s$ exchanging its cusps. By Lemma 9.2, $s$ maps meridian to meridian, so it
  extends over the filled cusps. Filling $c_s$ gives $M_f\setminus\gamma_k=M_k$, filling $c_p$ gives $M_f\setminus\sigma_k=M_{k+1}$
  (Lemma 11.2), and the extension of $s$ maps the first onto the second: $M_k\cong M_{k+1}$ (the manifold, not yet the class).
  This is a different kind of identification from $\bar h$ of Theorem 14.6, which maps the puncture cusp to the puncture cusp
  (Computation 12.4) and is the one used in the proof.

**Conjecture 16.7 (general picture).**
1. Along an endless chain, $\lambda_k\to e^{h(f)}$ (the bound of Lemma 16.4), geometrically fast.
2. If $f$ is pseudo-Anosov, the default choice (smallest period first) always ends the chain.
3. Forced endless chains need a closed class that is not pseudo-Anosov, and from some stage on the drilled manifolds are all
   the same; the class moves by a fixed shear inside one fibred cone towards a boundary ray, where $\lambda\to e^{h(f)}$.

**Questions.**
1. Which closed classes admit forced endless chains? Is it always a fractional Dehn twist with all pieces periodic?
2. Can the self-similarity be seen on the surface, as an explicit braid of $Q$ in $\Sigma$ that reproduces itself?
3. For the persistent-orbit chains (16.3): are their stages also fibrations of one manifold, with a shear by $4+2s$?
4. Can one detect an endless chain early (for example from the period pattern of the orbits) and switch to another choice?
5. Is the step homeomorphism $\bar h$ of $M_f$ (Theorem 14.6) isotopic to a torus twist along $T_\delta$, or does it only act like one
   on $H^1$ (Proposition 14.8)? Is the shear $4$ the Euler-characteristic $4g-4$ or the order of $f$ on $\Sigma\setminus\delta$? A genus-3
   example would separate the two.

---

## References

- I. Agol, *Ideal triangulations of pseudo-Anosov mapping tori*, Contemp. Math. 560 (2011). [arXiv:1008.1606](https://arxiv.org/abs/1008.1606)
- M. Bestvina, M. Handel, *Train-tracks for surface homeomorphisms*, Topology 34 (1995).
- J. Birman, *Mapping class groups and their relationship to braid groups*, Comm. Pure Appl. Math. 22 (1969).
- P. Brinkmann, *A note on pseudo-Anosov maps with small growth rate*, Experiment. Math. 13 (2004). [arXiv:math/0309411](https://arxiv.org/abs/math/0309411)
- M. Culler, N. Dunfield, M. Goerner, J. Weeks, *SnapPy*, a computer program for studying the geometry and topology of 3-manifolds.
- C. J. Earle, J. Eells, *A fibre bundle description of Teichmüller theory*, J. Differential Geom. 3 (1969).
- B. Farb, D. Margalit, *A primer on mapping class groups*, Princeton (2012).
- A. Fathi, F. Laudenbach, V. Poénaru, *Travaux de Thurston sur les surfaces*, Astérisque 66–67 (1979); English translation *Thurston's work on surfaces*, Princeton (2012).
- D. Fried, *The geometry of cross sections to flows*, Topology 21 (1982); *Flow equivalence, hyperbolic systems and a new zeta function for flows*, Comment. Math. Helv. 57 (1982).
- F. Guéritaud, *Veering triangulations and Cannon–Thurston maps*, J. Topol. 9 (2016).
- M.-E. Hamstrom, *Homotopy groups of the space of homeomorphisms on a 2-manifold*, Illinois J. Math. 10 (1966).
- C. Hodgson, H. Rubinstein, H. Segerman, S. Tillmann, *Veering triangulations admit strict angle structures*, Geom. Topol. 15 (2011).
- A. Issa, *Veering triangulations and the Bestvina–Handel algorithm*, Master's thesis, University of Melbourne.
- W. Jaco, P. Shalen, *Seifert fibered spaces in 3-manifolds*, Mem. Amer. Math. Soc. 220 (1979); K. Johannson, *Homotopy equivalences of 3-manifolds with boundaries*, LNM 761 (1979).
- E. Kin, S. Kojima, M. Takasawa, *Minimal dilatations of pseudo-Anosovs generated by the magic 3-manifold and their asymptotic behavior*, Algebr. Geom. Topol. 13 (2013).
- I. Kra, *On the Nielsen–Thurston–Bers type of some self-maps of Riemann surfaces*, Acta Math. 146 (1981).
- M. Landry, Y. Minsky, S. Taylor, *A polynomial invariant for veering triangulations*, J. Eur. Math. Soc. (2023); *Flows, growth rates, and the veering polynomial*, Ergodic Theory Dynam. Systems (2023).
- F. Laudenbach, S. Blank, *Isotopie de formes fermées en dimension trois*, Invent. Math. 54 (1979).
- C. McMullen, *Polynomial invariants for fibered 3-manifolds and Teichmüller geodesics for foliations*, Ann. Sci. École Norm. Sup. 33 (2000).
- Y. Minsky, S. Taylor, *Fibered faces, veering triangulations, and the arc complex*, Geom. Funct. Anal. 27 (2017).
- G. D. Mostow, *Quasi-conformal mappings in n-space and the rigidity of hyperbolic space forms*, Publ. Math. IHÉS 34 (1968).
- J.-P. Otal, *The hyperbolization theorem for fibered 3-manifolds*, SMF/AMS Texts and Monographs 7 (2001).
- A. Parlak, *Computation of the taut, the veering and the Teichmüller polynomials*, Experiment. Math. (2021).
- R. Penner, *Bounds on least dilatations*, Proc. Amer. Math. Soc. 113 (1991).
- G. Prasad, *Strong rigidity of Q-rank 1 lattices*, Invent. Math. 21 (1973).
- P. Scott, *The geometries of 3-manifolds*, Bull. London Math. Soc. 15 (1983).
- W. Thurston, *A norm for the homology of 3-manifolds*, Mem. Amer. Math. Soc. 339 (1986); *Hyperbolic structures on 3-manifolds II*, [arXiv:math/9801045](https://arxiv.org/abs/math/9801045).
- C.-Y. Tsai, *The asymptotic behavior of least pseudo-Anosov dilatations*, Geom. Topol. 13 (2009).
- F. Waldhausen, *On irreducible 3-manifolds which are sufficiently large*, Ann. of Math. 87 (1968).

## Reproducing the computations

All scripts are in `scripts/cut-study` on the branch `cut-study` (bundled with `npx rolldown … --platform node`):
`coordinator.mjs`, `worker.ts`, `analyze.mjs` (the main study), `chain-study.ts` (follow a chain, record nodes),
`poly.mjs`/`chain-polys.mjs` (exact characteristic polynomials), `veering-test.ts` (veering triangulations, SnapPea files),
`veering-classes.ts` and `veering-cone.ts` (classes, isomorphisms, cone). The SnapPy checks are small Python scripts using
SnapPy 3.3 (`pip install snappy`).
