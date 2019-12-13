$merge($each($, function($v, $k) { $exists($v.value) ? { $k:$v.value } : $exists($v.object) ? { $k:$v.object }: { $k:$v } }))
