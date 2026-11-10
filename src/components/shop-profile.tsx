import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getShopProfile, saveShopProfile } from "@/lib/shop.functions";

type ProfileData = { display_name: string; shop_name: string; avatar_url: string };

export function ShopProfile({ onClose }: { onClose: () => void }) {
  const cache = useQueryClient();
  const getProfile = useServerFn(getShopProfile);
  const saveProfile = useServerFn(saveShopProfile);
  const profile = useQuery<ProfileData>({ queryKey: ["profile"], queryFn: () => getProfile() });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ display_name: string; shop_name: string } | null>(null);
  return (
    <section className="mt-4 rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-bold">Meri profile</h2>
      {profile.isPending ? (
        <p>Load ho raha hai…</p>
      ) : profile.isError ? (
        <>
          <p role="alert">Profile load nahi hui.</p>
          <Button className="mt-2" onClick={() => profile.refetch()}>
            Dobara
          </Button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            setConfirm({
              display_name: String(values.get("display_name") ?? "").trim(),
              shop_name: String(values.get("shop_name") ?? "").trim(),
            });
          }}
          className="mt-3 grid gap-3"
        >
          <label>
            Naam
            <input
              name="display_name"
              maxLength={100}
              defaultValue={profile.data.display_name}
              className="mt-1 h-11 w-full rounded-xl border bg-background px-3"
            />
          </label>
          <label>
            Dukaan ka naam
            <input
              name="shop_name"
              maxLength={100}
              defaultValue={profile.data.shop_name}
              className="mt-1 h-11 w-full rounded-xl border bg-background px-3"
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Band karein
            </Button>
          </div>
        </form>
      )}
      {confirm && (
        <div className="mt-4">
          <p>
            {confirm.display_name} · {confirm.shop_name} — save karein?
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await saveProfile({ data: confirm });
                  await cache.invalidateQueries({ queryKey: ["profile"] });
                  setConfirm(null);
                  toast.success("Profile save ho gayi.");
                  onClose();
                } catch {
                  toast.error("Profile save nahi hui.");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Haan
            </Button>
            <Button variant="outline" disabled={saving} onClick={() => setConfirm(null)}>
              Nahi
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
