import { databases, DATABASE_ID, COLLECTION_USERS, ID, sanitizeId } from "./appwrite";

const USERS = [
  { id: "admin@123", role: "admin", password: "123456", defaultPassword: "123456" },
  { id: "081bct049", role: "student", password: "Ax-bolt-312", defaultPassword: "Ax-bolt-312" },
  { id: "081bct050", role: "student", password: "Zr-wave-857", defaultPassword: "Zr-wave-857" },
  { id: "081bct051", role: "student", password: "Qn-rock-421", defaultPassword: "Qn-rock-421" },
  { id: "081bct052", role: "student", password: "Wy-mint-693", defaultPassword: "Wy-mint-693" },
  { id: "081bct053", role: "student", password: "Jp-flux-178", defaultPassword: "Jp-flux-178" },
  { id: "081bct054", role: "student", password: "Kd-glow-534", defaultPassword: "Kd-glow-534" },
  { id: "081bct055", role: "student", password: "Vm-peak-267", defaultPassword: "Vm-peak-267" },
  { id: "081bct056", role: "student", password: "Fb-coal-819", defaultPassword: "Fb-coal-819" },
  { id: "081bct057", role: "student", password: "Lh-dusk-340", defaultPassword: "Lh-dusk-340" },
  { id: "081bct058", role: "student", password: "Tc-vein-705", defaultPassword: "Tc-vein-705" },
  { id: "081bct059", role: "student", password: "Rg-dawn-462", defaultPassword: "Rg-dawn-462" },
  { id: "081bct060", role: "student", password: "Nx-tide-988", defaultPassword: "Nx-tide-988" },
  { id: "081bct061", role: "student", password: "Ps-orb-151", defaultPassword: "Ps-orb-151" },
  { id: "081bct062", role: "student", password: "Hc-mist-623", defaultPassword: "Hc-mist-623" },
  { id: "081bct063", role: "student", password: "Ew-fern-394", defaultPassword: "Ew-fern-394" },
  { id: "081bct064", role: "student", password: "Yd-blaze-570", defaultPassword: "Yd-blaze-570" },
  { id: "081bct065", role: "student", password: "Gk-crest-213", defaultPassword: "Gk-crest-213" },
  { id: "081bct066", role: "student", password: "Bn-volt-847", defaultPassword: "Bn-volt-847" },
  { id: "081bct067", role: "student", password: "Om-reef-436", defaultPassword: "Om-reef-436" },
  { id: "081bct068", role: "student", password: "Sc-lynx-709", defaultPassword: "Sc-lynx-709" },
  { id: "081bct069", role: "student", password: "Uf-nova-182", defaultPassword: "Uf-nova-182" },
  { id: "081bct070", role: "student", password: "Ai-pine-655", defaultPassword: "Ai-pine-655" },
  { id: "081bct071", role: "student", password: "Cj-stark-328", defaultPassword: "Cj-stark-328" },
  { id: "081bct072", role: "student", password: "Dv-haze-904", defaultPassword: "Dv-haze-904" },
  { id: "081bct073", role: "student", password: "Mr-echo-471", defaultPassword: "Mr-echo-471" },
  { id: "081bct074", role: "student", password: "Ip-salt-236", defaultPassword: "Ip-salt-236" },
  { id: "081bct075", role: "student", password: "Tl-grove-789", defaultPassword: "Tl-grove-789" },
  { id: "081bct076", role: "student", password: "Bk-shard-514", defaultPassword: "Bk-shard-514" },
  { id: "081bct077", role: "student", password: "Nw-rune-063", defaultPassword: "Nw-rune-063" },
  { id: "081bct078", role: "student", password: "Ov-cleft-342", defaultPassword: "Ov-cleft-342" },
  { id: "081bct079", role: "student", password: "Xm-spire-817", defaultPassword: "Xm-spire-817" },
  { id: "081bct080", role: "student", password: "Fr-caste-195", defaultPassword: "Fr-caste-195" },
  { id: "081bct081", role: "student", password: "Hs-prism-640", defaultPassword: "Hs-prism-640" },
  { id: "081bct082", role: "student", password: "Le-storm-423", defaultPassword: "Le-storm-423" },
  { id: "081bct083", role: "student", password: "Pu-delta-758", defaultPassword: "Pu-delta-758" },
  { id: "081bct084", role: "student", password: "Ck-ivory-281", defaultPassword: "Ck-ivory-281" },
  { id: "081bct085", role: "student", password: "Dn-vortex-936", defaultPassword: "Dn-vortex-936" },
  { id: "081bct086", role: "student", password: "Wf-bluff-517", defaultPassword: "Wf-bluff-517" },
  { id: "081bct087", role: "student", password: "Ag-knoll-384", defaultPassword: "Ag-knoll-384" },
  { id: "081bct088", role: "student", password: "Jb-raven-052", defaultPassword: "Jb-raven-052" },
  { id: "081bct089", role: "student", password: "Qe-flint-729", defaultPassword: "Qe-flint-729" },
  { id: "081bct090", role: "student", password: "Ri-cedar-416", defaultPassword: "Ri-cedar-416" },
  { id: "081bct091", role: "student", password: "Sx-moat-893", defaultPassword: "Sx-moat-893" },
  { id: "081bct092", role: "student", password: "Tg-latch-267", defaultPassword: "Tg-latch-267" },
  { id: "081bct093", role: "student", password: "Yv-crux-741", defaultPassword: "Yv-crux-741" },
  { id: "081bct094", role: "student", password: "Zp-shoal-308", defaultPassword: "Zp-shoal-308" },
  { id: "081bct095", role: "student", password: "Kb-trace-675", defaultPassword: "Kb-trace-675" },
  { id: "081bct096", role: "student", password: "Mc-drift-142", defaultPassword: "Mc-drift-142" },
];

export async function seedUsers() {
  for (const user of USERS) {
    const docId = sanitizeId(user.id);
    await databases.createDocument(
      DATABASE_ID,
      COLLECTION_USERS,
      docId,
      {
        userId: user.id,
        role: user.role,
        password: user.password,
        defaultPassword: user.defaultPassword,
        hasChangedPassword: false,
        lastLogin: null,
      }
    );
  }
  console.log("Seeded all users");
}
