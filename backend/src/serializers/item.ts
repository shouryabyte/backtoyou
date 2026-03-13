export function serializeItem(
  item: any,
  viewer: { id: string; role: "USER" | "ADMIN" }
) {
  const canSeePrivate = viewer.role === "ADMIN" || String(item.ownerId) === viewer.id;
  return {
    id: String(item._id),
    type: item.type,
    status: item.status,
    title: item.title,
    description: item.description ?? "",
    category: item.category,
    color: item.color ?? "",
    location: item.location ?? "",
    eventAt: new Date(item.eventAt).toISOString(),
    images: (item.images ?? []).map((img: any) => ({ url: img.url, provider: img.provider })),
    ownerId: String(item.ownerId),
    publicDetails: item.publicDetails ?? {},
    ...(canSeePrivate ? { privateDetails: item.privateDetails ?? {} } : {})
  };
}

