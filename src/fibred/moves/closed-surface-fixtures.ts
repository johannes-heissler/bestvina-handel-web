/**
 * Decision nodes of the cut study (closed surfaces where the closed-surface move is next), as test fixtures: G by the
 * stars of its junctions, and g. Each is the state the autopilot reached from a word in the generators of the genus-2
 * or genus-3 model, marked as closed.
 *
 * @module
 */
import { CombinatorialMap } from "../../graph/combinatorial-map";
import { fromStars } from "../../graph/from-boundary-words";
import { parseMap } from "../../graph/path-parser";
import { FibredSurface } from "../fibred-surface";

/** The names of the junctions with their stars (counterclockwise), and g as text. */
function build(junctions: readonly (readonly [string, readonly string[]])[], map: string): FibredSurface {
  const graph = fromStars(junctions.map(([, star]) => star));
  graph.vertices.forEach((v, i) => (v.name = (junctions[i] as readonly [string, readonly string[]])[0]));
  const fs = new FibredSurface({
    graph,
    g: CombinatorialMap.fromEdgeImages(graph, graph, parseMap(map, graph).images),
  });
  fs.isClosed = true;
  return fs;
}

/**
 * g2-mixed:L6:s106008: P_α⁻¹ ∘ D_c₁⁻¹ ∘ P_δ⁻¹ ∘ D_a ∘ D_b⁻¹ ∘ D_a.
 * The junction q has two gates and is mapped to the fixed singularity v: blown up, its gates go to different
 * corners of the polygon of v.
 */
export const entersQ = (): FibredSurface =>
  build(
    [
      ["v", ["a", "c", "d", "Y", "X"]],
      ["q", ["A", "B", "z"]],
      ["w", ["b", "C", "y"]],
      ["s", ["D", "Z", "x"]],
    ],
    "a ↦ a z D c y d x Y C a z D c b z D Y C, c ↦ c y d, d ↦ d Z A X Z B, z ↦ a z D c, y ↦ Z B C d Z A c y, b ↦ x Y C a z D c b z D Y C, x ↦ y d x Y C a z D c b z D Y C a z D c b z x",
  );

/**
 * g3-mixed:L8:s308026: P_b⁻¹ ∘ D_d⁻¹ ∘ P_d⁻¹ ∘ P_a⁻¹ ∘ P_f⁻¹ ∘ P_d ∘ D_f ∘ D_d⁻¹.
 * The singularity p is fixed, with 4 prongs. The Perron–Frobenius lengths span 12 orders of magnitude (the strip
 * j has length 1.9e-7, c has 7.4e4), so a whole strip can be shorter than the tolerance along a long image.
 */
export const shortBranch = (): FibredSurface =>
  build(
    [
      ["p", ["Z", "h", "F", "a", "J"]],
      ["r", ["C", "z", "y"]],
      ["q", ["e", "U", "d"]],
      ["v", ["u", "X", "c"]],
      ["s", ["B", "D", "x"]],
      ["t", ["A", "b", "i"]],
      ["v_2", ["H", "I", "j"]],
      ["v_1", ["E", "Y", "f"]],
    ],
    "a ↦ F Y z J I b x u e f h j a i H Z C X D U c y E d, f ↦ j a b D e Y C u d x c z h I A J H F E U X B i j Z y f J I A J H F Y z J I b x u e f h j a i H Z C X D U c y E d x c y E d x c z h I A J H F E U X B i j Z y f h j a i j F Y z J I b x u e f h j a i H Z C X D U c y E d B A J I A J H F Y z J I b x u e f h j a i H Z C X D e Y C X D e Y C u d x c z h I A J H F E U X B i j Z y f, y ↦ f h j a i, z ↦ Y z, d ↦ C X D e Y C, e ↦ z h, c ↦ d x c z h I A J H F E U X B i j Z y f h j a i j F Y z J I b x u e f h j a i H Z C X D U c y E d B A J I A J H F Y z J I b x u e Y z h j a b D e Y C u d x c z h I A J H F E U X B i j Z y f J I A J H F Y z J I b x u e f h j a i H Z C X D U c y E d x c y E d x c z h I A J H F E U X B i j Z y f h j a i j F Y z J I b x u e f h j a i H Z C X D U c y E d B A J I A J H F Y z J I b x u e f h j a i H Z C X D e Y C X D e Y C u d x c z h I A J H F E U X B i j Z y f h j a b D e Y C u d x c z h I A J H F E U X B i j Z y f J I A J H F Y z J I b x u e f h j a i H Z C X D U c y E d x c y E d x c z h I A J H F E U X B i j Z y f h j a i j a b D e Y C u d x c z h I A J H F E U X B i j Z y f J I A J H F Y z J I b x u e f h j a i H Z C X D e Y C X D e Y C u d x c z h I A J H F E U X B i j Z y f h j a i j F Y z J I b x u e f h j a i H Z C X D U c y E d B A J H F Y z J I b x u e f h j a i H Z C X D U c y E d x c y E d x c z h I A J H F E U X B i j Z y f h j a i j a b D e Y C u d x c z h I A J H F E U X B i j Z y f J I A J H F Y z J I b x u e f h j a i H Z C X D e Y C X D e Y C u d x c z h I A J H F E U X B i j Z y f h j a i j F Y z J I b x u e f h j a i H Z C X D U c y E d B A J H Z y E U X B i j Z y f h j a i j a b D e Y C u d x c z h I A J H F E U X B i j Z y f J I A J H F Y z J I b x u e f h j a i H Z C X D U c y E d x c y E d x c z h I A J H F E U X B i j Z y f h j a i j F Y z J I b x u e f h j a i H Z C X D U c y E d B A J I A J H F Y z J I b x u e, u ↦ e Y, h ↦ h j a b D e Y C u d x c z h I A J H F E U X B i j Z y f J I A J H F Y z J I b x u e f h j a i H Z C X D U c y E d x c y E d x c z h I A J H F E U X B i j Z y f h j a i j F Y z J I b x u e f h j a i H Z C X D U c y E d B A J I A J H F Y z J I b x u e f h j a i H Z C X D e Y C X D e Y C u d x c z h I A J H F E U X B i j Z y f h j a, x ↦ u, i ↦ B, b ↦ x, j ↦ i j",
  );

/**
 * g2-mixed:L8:s108015: D_d⁻¹ ∘ D_d⁻¹ ∘ D_c ∘ D_a⁻¹ ∘ P_β̄ ∘ D_c ∘ D_b ∘ D_c₁.
 * The singularity q has period 3 (its prongs period 9). The sides of its polygon are thin compared with the rounding
 * error of the slit heights, which are traced along L through 46 branches.
 */
export const thinSide = (): FibredSurface =>
  build(
    [
      ["v", ["U", "x", "D"]],
      ["w", ["C", "X", "y"]],
      ["q", ["A", "Y", "d"]],
      ["p", ["B", "a", "b", "z"]],
      ["r", ["Z", "c", "u"]],
    ],
    "x ↦ x y d x y d x, y ↦ y d x C, d ↦ u x y d x y d x y d x C u x y d, z ↦ A, a ↦ Y C u x y d U Z B z u x y d x y d x y d x C u x y d x y d x y d x C u x y d U Z a Y C u x y d U Z B z, b ↦ d x C Z b z u D Y X U c y A z u D Y X U c X D Y X D Y X D Y X U c X D Y X D Y X D Y X U Z b z u D Y X U c y, u ↦ z u, c ↦ b z u D Y X U c",
  );

/**
 * g2-twistpush:T8P1:s481021, after a cut at q (period 3): D_d ∘ D_c₁⁻¹ ∘ D_c ∘ D_a ∘ D_c⁻¹ ∘ D_b⁻¹ ∘ D_c⁻¹ ∘ D_a ∘ P_β̄⁻¹.
 * The three punctures of P are an orbit, but only one of them borders the polygon of the fixed singularity w: the
 * shortcut at w has to delete strips between punctures of P too.
 */
export const awayFromQ = (): FibredSurface =>
  build(
    [
      ["v_4_b", ["A", "w_γ_1", "u_4", "A_2", "X"]],
      ["v_5_c", ["s_γ_1", "c_15", "u_3", "W_γ_1"]],
      ["w", ["D", "a", "C"]],
      ["v", ["U_4", "U_3", "c"]],
      ["q", ["Z_9", "a_2", "d"]],
      ["r", ["S_γ_1", "z_9", "b"]],
      ["p", ["C_15", "B", "x"]],
    ],
    "s_γ_1 ↦ x u_4 c a X B z_9 d C U_3 c_15 x A_2, c_15 ↦ x A_2 d a w_γ_1 s_γ_1, w_γ_1 ↦ u_4 c a X B z_9 d C U_3 c_15 x A_2 d a w_γ_1 s_γ_1 b x u_4 c a X B z_9 d C U_3 c_15 x A_2 d a w_γ_1 s_γ_1 b, u_4 ↦ u_4 c a X B z_9 d C U_3 c_15 x A_2 d a w_γ_1 s_γ_1 b x u_4 c a X B z_9 d C U_3 c_15 x A_2 d a w_γ_1, a ↦ a X B z_9 d a, c ↦ u_3 c, d ↦ c a X B z_9 d, a_2 ↦ U_3 W_γ_1 A D a_2 X C_15 u_3 c D Z_9 b x A C U_4 X B S_γ_1 W_γ_1 A D a_2 X C_15 u_3 c D Z_9 b x A C U_4, z_9 ↦ d a u_4, b ↦ Z_9, x ↦ b x, u_3 ↦ C_15",
  );

/**
 * g2-twistpush:T8P2:s482012, after four closed-surface moves: D_c₁⁻¹ ∘ D_a ∘ P_α ∘ P_β̄⁻¹ ∘ D_a ∘ D_c₁ ∘ D_c ∘ D_d⁻¹ ∘ D_c ∘ D_d⁻¹.
 * Traced in floating point, the leaf of the prong at v_1_c (period 18) seems to run into a corner after 3 branches;
 * it passes within rounding error of the boundary of a branch there.
 */
export const falseCorner = (): FibredSurface =>
  build(
    [
      ["v_12", ["b", "V_1_α", "q_β", "Q_γ", "P_γ", "r_α", "T_δ", "B", "z"]],
      ["w", ["U", "v_1_α", "S_δ"]],
      ["q", ["p_γ", "C", "r_δ"]],
      ["r", ["q_γ", "D", "c"]],
      ["s", ["Q_β", "X", "d"]],
      ["t", ["t_δ", "Y", "x"]],
      ["v_2", ["s_δ", "Z", "y"]],
      ["v_1", ["R_α", "R_δ", "u"]],
    ],
    "v_1_α ↦ v_1_α b z y x d c r_δ u v_1_α b r_α u S_δ Z b z y x d c r_δ u v_1_α, b ↦ b z y x d c r_δ u v_1_α b z y x d c r_δ u v_1_α b r_α u S_δ Z b z y x d c r_δ u v_1_α b z y x d c r_δ u v_1_α b, r_α ↦ r_α u v_1_α b T_δ Y, z ↦ z y, q_β ↦ Q_γ, r_δ ↦ u v_1_α b r_α u S_δ, p_γ ↦ R_α, c ↦ r_δ, q_γ ↦ p_γ, d ↦ c, x ↦ d, t_δ ↦ Q_β V_1_α U R_δ C D X Y Z B z s_δ U R_α B V_1_α U R_δ C D X Y Z B V_1_α U R_δ C D X Y Z B z s_δ U R_α B V_1_α U R_δ C D X Y Z B V_1_α U R_δ C D X Y Z B V_1_α U R_δ C D X Y Z B z s_δ U R_α B V_1_α U R_δ C D X Y Z B V_1_α U R_δ C D X Y Z B z y t_δ B V_1_α U R_α, s_δ ↦ t_δ B V_1_α U R_α B V_1_α U R_δ C D X Y Z B V_1_α U R_δ C D X Y Z B z s_δ U R_α B V_1_α U R_δ C D X Y Z B V_1_α U R_δ C D X Y Z B V_1_α U R_δ C D X Y Z B z s_δ U R_α B V_1_α U R_δ C D X Y Z B V_1_α, y ↦ x, u ↦ Z b z y x d c r_δ u",
  );
